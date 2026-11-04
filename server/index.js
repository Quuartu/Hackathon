import { createServer } from 'node:http'
import neo4j from 'neo4j-driver'
import { APPROVE, LIST, REPORT, toBattery } from './passport.js'

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE } = process.env
const PORT = 3001
const MAX_BODY = 10_000
const MAX_REASON = 500

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD), {
  disableLosslessIntegers: true,
})

const query = (cypher, params, routing) =>
  driver.executeQuery(cypher, params, { database: NEO4J_DATABASE, routing })

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
  return JSON.parse(text || '{}')
}

async function write(response, cypher, params) {
  const { records } = await query(cypher, params, neo4j.routing.WRITE)
  if (records.length) send(response, 200, { ok: true })
  else send(response, 409, { error: 'This action no longer applies to this battery.' })
}

async function handle(request, response) {
  const [, id, action] = request.url.match(/^\/api\/batteries(?:\/([^/]+)\/(report|approve-waste))?$/) ?? []

  if (request.method === 'GET' && request.url === '/api/batteries') {
    const { records } = await query(LIST, {}, neo4j.routing.READ)
    return send(response, 200, records.map((record) => toBattery(record.toObject())))
  }
  if (request.method !== 'POST' || !action) return send(response, 404, { error: 'Not found.' })

  // A JSON content type stops other websites from posting here through the browser.
  if (request.headers['content-type'] !== 'application/json') {
    return send(response, 415, { error: 'Send JSON.' })
  }
  if (action === 'approve-waste') return write(response, APPROVE, { id })

  const { reason } = await readJson(request)
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
}).listen(PORT, '127.0.0.1', () => console.log(`API on http://127.0.0.1:${PORT}`))
