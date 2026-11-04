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
  setCors(response)
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

async function handle(request, response) {
  if (request.method === 'OPTIONS') {
    setCors(response)
    response.writeHead(204)
    return response.end()
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
  // Supports /api/telemetry, /api/telemetry/:id, /telemetry, /api/modules, and / with telemetry JSON
  const isTelemetryUrl = request.url.match(/^(?:\/api)?\/(?:telemetry|modules)(?:\/([^/?]+))?/)
  if (request.method === 'POST' && (isTelemetryUrl || request.url === '/')) {
    const body = await readJson(request)
    if (body.modules && (body.I_A !== undefined || isTelemetryUrl)) {
      const urlBatteryId = isTelemetryUrl?.[1]
      if (urlBatteryId && !body.batteryId) body.batteryId = urlBatteryId
      const { values, error } = parseTelemetry(body)
      if (error) return send(response, 400, { error })
      pendingTelemetry.set(values.batteryId, values)
      console.log(`[Telemetry received via API] Battery: ${values.batteryId}, I = ${values.I_A}A, Modules: ${values.modules.length}`)
      return send(response, 200, { ok: true, message: 'Telemetry received and staged for update', staged: values })
    }
  }

  // 5. POST Apply Telemetry to Neo4j
  const applyMatch = request.url.match(/^(?:\/api\/batteries\/([^/]+)\/apply-telemetry|\/api\/telemetry\/apply)$/)
  if (request.method === 'POST' && applyMatch) {
    const batteryId = applyMatch[1] || 'BAT-0001'
    const body = await readJson(request).catch(() => ({}))
    const pending = pendingTelemetry.get(batteryId) || (body.modules ? parseTelemetry(body).values : null)
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

  // 6. Existing battery routes
  const [path, id, action] = request.url.match(/^\/api\/batteries(?:\/([^/]+)\/(report|approve-waste))?$/) ?? []
  if (request.method !== 'POST' || !path) return send(response, 404, { error: 'Not found.' })

  // A JSON content type stops other websites from posting here through the browser.
  const contentType = request.headers['content-type'] ?? ''
  if (!contentType.includes('application/json')) {
    return send(response, 415, { error: 'Send JSON.' })
  }
  const body = await readJson(request)
  if (!action) return create(response, body)

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
createServer((request, response) => {
  handle(request, response).catch((failure) => {
    if (failure instanceof SyntaxError) return send(response, 400, { error: 'Invalid request.' })
    console.error(failure)
    send(response, 502, { error: 'Cannot reach the database.' })
  })
}).listen(PORT, '0.0.0.0', () => {
  console.log(`API running on http://127.0.0.1:${PORT}`)
  console.log(`Ready for ngrok: run 'ngrok http ${PORT}'`)
  console.log(`Endpoint: POST http://127.0.0.1:${PORT}/api/telemetry`)
})
