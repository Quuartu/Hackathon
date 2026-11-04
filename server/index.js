import { createServer } from 'node:http'
import neo4j from 'neo4j-driver'
import {
  APPLY_TELEMETRY,
  APPROVE,
  COMPANIES,
  CREATE_BATTERY,
  LIST,
  parseNewBattery,
  parseTelemetry,
  REPORT,
  toBattery,
} from './passport.js'

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE } = process.env
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
      const urlBatteryId = isTelemetryUrl?.[1]
      if (urlBatteryId && !body.batteryId) body.batteryId = urlBatteryId
      const { values, error } = parseTelemetry(body)
      if (error) return send(response, 400, { error })
      if (!pendingTelemetry.has(values.batteryId) && pendingTelemetry.size >= MAX_PENDING) {
        return send(response, 429, { error: 'Too many batteries are waiting for review.' })
      }
      pendingTelemetry.set(values.batteryId, values)
      console.log(`[Telemetry received via API] Battery: ${values.batteryId}, I = ${values.I_A}A, Modules: ${values.modules.length}`)
      return send(response, 200, { ok: true, message: 'Telemetry received and staged for update', staged: values })
    }
  }

  // 5. Battery routes, including applying telemetry to Neo4j
  const [path, id, action] = request.url.match(/^\/api\/batteries(?:\/([^/]+)\/(report|approve-waste|apply-telemetry))?$/) ?? []
  if (request.method !== 'POST' || !path) return send(response, 404, { error: 'Not found.' })

  // A JSON content type stops other websites from posting here through the browser.
  const contentType = request.headers['content-type'] ?? ''
  if (!contentType.includes('application/json')) {
    return send(response, 415, { error: 'Send JSON.' })
  }
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

// ponytail: localhost only and no login check, because logins still live in the browser. Add both before hosting this online.
// ngrok still works, because it connects from this computer.
createServer((request, response) => {
  handle(request, response).catch((failure) => {
    if (failure instanceof SyntaxError) return send(response, 400, { error: 'Invalid request.' })
    console.error(failure)
    send(response, 502, { error: 'Cannot reach the database.' })
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`API on http://127.0.0.1:${PORT}`)
  console.log(`Ready for ngrok: run 'ngrok http ${PORT}'`)
  console.log(`Endpoint: POST http://127.0.0.1:${PORT}/api/telemetry`)
})
