import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import neo4j from 'neo4j-driver'
import {
  hashPassword,
  openAccounts,
  parseLogin,
  parseScan,
  parseSignUp,
  SCANNING_ROLES,
  verifyPassword,
  WRITE_ROLES,
} from './accounts.js'
import {
  APPLY_TELEMETRY,
  APPROVE,
  COMPANIES,
  CREATE_BATTERY,
  FIND_BY_PASSPORT,
  LIST,
  parseNewBattery,
  parseTelemetry,
  REPORT,
  toBattery,
} from './passport.js'

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE, MONGODB_URI } = process.env
if (!MONGODB_URI) {
  console.error('MONGODB_URI is missing from db/.env. See the README, step 2.')
  process.exit(1)
}
const { client, accounts } = openAccounts(MONGODB_URI)
const DUPLICATE_KEY = 11000
const PORT = 3001
const MAX_BODY = 100_000
const MAX_REASON = 500
const MAX_PENDING = 100

// Stores pending telemetry received from ngrok / webhook until applied to Neo4j
const pendingTelemetry = new Map()

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD), {
  disableLosslessIntegers: true,
})

const query = (cypher, params, routing) =>
  driver.executeQuery(cypher, params, { database: NEO4J_DATABASE, routing })

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  let text = ''
  for await (const chunk of request) {
    text += chunk
    if (text.length > MAX_BODY) throw new SyntaxError('Body too large')
  }
  return JSON.parse(text || '{}') ?? {}
}

// A token in a header, not a cookie, so each tab can stay logged in as a different role during the demo.
// ponytail: sessions live in memory, so restarting the API logs everyone out. Move them to MongoDB if the API is ever hosted.
const sessions = new Map()
const tokenOf = (request) => request.headers.authorization?.replace(/^Bearer /, '')
const sessionOf = (request) => sessions.get(tokenOf(request))
// A JSON content type stops other websites from posting here through the browser.
const sentJson = (request) => (request.headers['content-type'] ?? '').includes('application/json')

function startSession(response, status, { email, role, company }) {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { email, role, company })
  send(response, status, { token, email, role, company })
}

async function signUp(response, body) {
  const { records } = await query(COMPANIES, {}, neo4j.routing.READ)
  const { values, error } = parseSignUp(body, records.map((record) => record.get('name')))
  if (error) return send(response, 400, { error })
  const { password, ...account } = values
  try {
    await accounts.insertOne({ ...account, passwordHash: await hashPassword(password), batteries: [] })
  } catch (failure) {
    if (failure.code !== DUPLICATE_KEY) throw failure
    return send(response, 409, { error: 'An account with this email already exists.' })
  }
  return startSession(response, 201, account)
}

async function logIn(response, body) {
  const { values, error } = parseLogin(body)
  if (error) return send(response, 400, { error })
  const account = await accounts.findOne({ email: values.email })
  if (!account || !(await verifyPassword(values.password, account.passwordHash))) {
    return send(response, 401, { error: 'Incorrect email or password.' })
  }
  return startSession(response, 200, account)
}

async function readMe(request, response) {
  const session = sessionOf(request)
  const account = session && (await accounts.findOne({ email: session.email }))
  if (!account) return send(response, 401, { error: 'Please log in again.' })
  return send(response, 200, { ...session, batteries: account.batteries.map((battery) => battery.passportId) })
}

async function addScan(request, response, body) {
  const session = sessionOf(request)
  if (!session) return send(response, 401, { error: 'Please log in again.' })
  if (!SCANNING_ROLES.includes(session.role)) return send(response, 403, { error: 'Your account cannot do this.' })
  const { values, error } = parseScan(body)
  if (error) return send(response, 400, { error })
  const { passportId } = values
  // Batteries are identified by their passport, so a battery ID such as BAT-0001 is refused here too.
  const { records } = await query(FIND_BY_PASSPORT, { passportId }, neo4j.routing.READ)
  if (!records.length) return send(response, 404, { error: 'No battery found with this passport ID.' })
  const filter = { email: session.email }
  // Newest first, with no duplicates. MongoDB keeps only the IDs: battery data stays in Neo4j.
  await accounts.bulkWrite([
    { updateOne: { filter, update: { $pull: { batteries: { passportId } } } } },
    {
      updateOne: {
        filter,
        update: { $push: { batteries: { $each: [{ passportId, at: new Date().toISOString() }], $position: 0 } } },
      },
    },
  ])
  return send(response, 200, { ok: true })
}

async function accountRoute(request, response, route) {
  if (route === 'POST /api/auth/logout') {
    sessions.delete(tokenOf(request))
    return send(response, 200, { ok: true })
  }
  // After a failed first connection the driver stays closed for good, so reopen it here.
  await client.connect()
  if (route === 'GET /api/me') return readMe(request, response)
  if (!sentJson(request)) return send(response, 415, { error: 'Send JSON.' })
  const body = await readJson(request)
  if (route === 'POST /api/auth/signup') return signUp(response, body)
  if (route === 'POST /api/auth/login') return logIn(response, body)
  return addScan(request, response, body)
}

const ACCOUNT_ROUTES = new Set([
  'GET /api/me',
  'POST /api/auth/signup',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/me/batteries',
])

async function write(response, cypher, params) {
  const { records } = await query(cypher, params, neo4j.routing.WRITE)
  if (records.length) send(response, 200, { ok: true })
  else send(response, 409, { error: 'This action no longer applies to this battery.' })
}

async function create(response, body) {
  const { values, error } = parseNewBattery(body)
  if (error) return send(response, 400, { error })
  try {
    const { records } = await query(CREATE_BATTERY, values, neo4j.routing.WRITE)
    if (!records.length) return send(response, 400, { error: 'Unknown model or operator.' })
    return send(response, 201, records[0].toObject())
  } catch (failure) {
    if (failure.code !== 'Neo.ClientError.Schema.ConstraintValidationFailed') throw failure
    return send(response, 409, { error: 'A battery with this battery ID or passport ID already exists.' })
  }
}

async function applyTelemetry(response, batteryId) {
  const pending = pendingTelemetry.get(batteryId)
  if (!pending) return send(response, 400, { error: 'No pending telemetry to apply for this battery.' })

  const params = {
    batteryId,
    I_A: pending.I_A,
    modules: pending.modules,
  }
  const { records } = await query(APPLY_TELEMETRY, params, neo4j.routing.WRITE)
  if (!records.length) return send(response, 404, { error: 'Battery not found in database.' })
  pendingTelemetry.delete(batteryId)
  console.log(`[Neo4j updated] Battery ${batteryId} modules and diagnosis updated from telemetry`)
  return send(response, 200, { ok: true, updated: batteryId, diagnosis: records[0].get('diagnosis') })
}

async function handle(request, response) {
  // Supports /api/telemetry, /api/telemetry/:id, /telemetry, /api/modules, and / with telemetry JSON
  const isTelemetryUrl = request.url.match(/^(?:\/api)?\/(?:telemetry|modules)(?:\/([^/?]+))?(?:\?.*)?$/)
  const isTelemetry = isTelemetryUrl || request.url === '/'

  // ngrok adds this header, and it must only reach telemetry. Telemetry itself only waits for a person to apply it.
  if (request.headers['x-forwarded-for'] && !isTelemetry) return send(response, 403, { error: 'Not available here.' })

  if (isTelemetry) {
    setCors(response)
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      return response.end()
    }
  }

  // 1. GET Batteries (with pending telemetry attached)
  if (request.method === 'GET' && request.url === '/api/batteries') {
    const { records } = await query(LIST, {}, neo4j.routing.READ)
    return send(
      response,
      200,
      records.map((record) => {
        const battery = toBattery(record.toObject())
        battery.pendingTelemetry = pendingTelemetry.get(battery.batteryId) ?? null
        return battery
      }),
    )
  }

  // 2. GET Companies
  if (request.method === 'GET' && request.url === '/api/companies') {
    const { records } = await query(COMPANIES, {}, neo4j.routing.READ)
    return send(response, 200, records.map((record) => record.toObject()))
  }

  // 3. GET Telemetry (inspect current pending telemetry)
  if (request.method === 'GET' && (request.url === '/api/telemetry' || request.url.startsWith('/api/telemetry?'))) {
    return send(response, 200, Object.fromEntries(pendingTelemetry))
  }

  // 4. POST Telemetry (from ngrok or local simulator)
  if (request.method === 'POST' && isTelemetry) {
    const body = await readJson(request)
    if (body.modules && (body.I_A !== undefined || isTelemetryUrl)) {
      const urlPassportId = isTelemetryUrl?.[1]
      if (urlPassportId && !body.batteryPassportId) body.batteryPassportId = urlPassportId
      const { values, error } = parseTelemetry(body)
      if (error) return send(response, 400, { error })
      const { records } = await query(FIND_BY_PASSPORT, { passportId: values.batteryPassportId }, neo4j.routing.READ)
      if (!records.length) return send(response, 404, { error: 'No battery found with this passport ID.' })
      const batteryId = records[0].get('batteryId')
      if (!pendingTelemetry.has(batteryId) && pendingTelemetry.size >= MAX_PENDING) {
        return send(response, 429, { error: 'Too many batteries are waiting for review.' })
      }
      const staged = { ...values, batteryId }
      pendingTelemetry.set(batteryId, staged)
      console.log(`[Telemetry received via API] Passport: ${values.batteryPassportId}, I = ${values.I_A}A, Modules: ${values.modules.length}`)
      return send(response, 200, { ok: true, message: 'Telemetry received and staged for update', staged })
    }
  }

  // 5. Accounts, stored in MongoDB
  const route = `${request.method} ${request.url}`
  if (ACCOUNT_ROUTES.has(route)) return accountRoute(request, response, route)

  // 6. Battery routes, including applying telemetry to Neo4j
  const [path, id, action] = request.url.match(/^\/api\/batteries(?:\/([^/]+)\/(report|approve-waste|apply-telemetry))?$/) ?? []
  if (request.method !== 'POST' || !path) return send(response, 404, { error: 'Not found.' })

  // ponytail: this checks the role, not the company, so a manufacturer could approve another company's battery. Compare companies once there is a second one.
  const session = sessionOf(request)
  if (!session) return send(response, 401, { error: 'Please log in again.' })
  if (!WRITE_ROLES[action ?? 'create'].includes(session.role)) {
    return send(response, 403, { error: 'Your account cannot do this.' })
  }

  if (!sentJson(request)) return send(response, 415, { error: 'Send JSON.' })
  const body = await readJson(request)
  if (!action) return create(response, body)
  if (action === 'apply-telemetry') return applyTelemetry(response, id)

  const { reason, requestId } = body
  if (action === 'approve-waste') {
    if (typeof requestId !== 'string' || !requestId) return send(response, 400, { error: 'Invalid request.' })
    return write(response, APPROVE, { id, requestId })
  }

  if (typeof reason !== 'string' || !reason.trim() || reason.length > MAX_REASON) {
    return send(response, 400, { error: `The diagnosis must be 1 to ${MAX_REASON} characters.` })
  }
  return write(response, REPORT, { id, reason: reason.trim() })
}

// ponytail: localhost only, and reading batteries needs no login. Change both before hosting this online.
// ngrok still works, because it connects from this computer.
createServer((request, response) => {
  handle(request, response).catch((failure) => {
    if (failure instanceof SyntaxError) return send(response, 400, { error: 'Invalid request.' })
    console.error(failure)
    const database = failure.name.startsWith('Mongo') ? 'the accounts database (MongoDB)' : 'the database'
    send(response, 502, { error: `Cannot reach ${database}.` })
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`API on http://127.0.0.1:${PORT}`)
  console.log(`Ready for ngrok: run 'ngrok http ${PORT}'`)
  console.log(`Endpoint: POST http://127.0.0.1:${PORT}/api/telemetry`)
})
