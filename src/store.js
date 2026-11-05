import { useSyncExternalStore } from 'react'
import { authHeaders, currentToken, logOut, post, UNREACHABLE } from './auth.js'

export function findBattery(batteries, code) {
  const wanted = code.trim().toLowerCase()
  return batteries.find((b) => b.batteryPassportId.toLowerCase() === wanted)
}

// Next free IDs in the database's format: BAT-0002 and BP-2027-0002.
export function nextBatteryIds(batteries) {
  const numbers = batteries
    .flatMap((b) => [b.batteryId, b.batteryPassportId])
    .map((id) => Number(id.match(/-(\d+)$/)?.[1] ?? 0))
  const next = String(Math.max(0, ...numbers) + 1).padStart(4, '0')
  return { batteryId: `BAT-${next}`, passportId: `BP-2027-${next}` }
}

// ponytail: polling is enough for the demo, push updates only if 5 seconds of delay becomes a problem
const POLL_MS = 5000

let state = { batteries: null, companies: [], scans: [], error: '', saving: false }
let latestRefresh = 0
let latestApplied = 0
const listeners = new Set()

function setState(change) {
  state = { ...state, ...change }
  listeners.forEach((listener) => listener())
}

async function readMe() {
  if (!currentToken()) return { scans: [] }
  const response = await fetch('/api/me', { headers: authHeaders() })
  if (response.status === 401) return { expired: true }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return { scans: result.batteries }
}

export async function refresh() {
  const ticket = ++latestRefresh
  const token = currentToken()
  let change
  let expired = false
  try {
    const [batteriesResponse, companiesResponse, me] = await Promise.all([
      fetch('/api/batteries'),
      fetch('/api/companies'),
      readMe(),
    ])
    if (!batteriesResponse.ok || !companiesResponse.ok) throw new Error(UNREACHABLE)
    const [batteries, companies] = await Promise.all([batteriesResponse.json(), companiesResponse.json()])
    expired = me.expired
    change = { batteries, companies, error: '', ...(me.scans && { scans: me.scans }) }
  } catch (failure) {
    change = { error: failure.message.includes('MongoDB') ? failure.message : UNREACHABLE }
  }
  // An older poll must not overwrite a newer result. This compares with the newest result, not the newest
  // request, because when MongoDB is down each answer takes longer than the gap between polls.
  if (ticket < latestApplied) return
  latestApplied = ticket
  setState(change)
  // The API restarted or the account is gone: back to the login screen.
  if (expired && token === currentToken()) logOut()
}

async function act(path, body) {
  setState({ saving: true })
  let failure = ''
  try {
    await post(`/api/batteries${path}`, body)
  } catch (error) {
    failure = error.message
  }
  await refresh()
  setState({ saving: false, ...(failure && { error: failure }) })
}

export async function createBattery(fields) {
  const created = await post('/api/batteries', fields)
  await refresh()
  return created
}

export const reportOutOfService = (id, reason) => act(`/${id}/report`, { reason })
export const approveWaste = (id, requestId) => act(`/${id}/approve-waste`, { requestId })
export const applyTelemetry = (id) => act(`/${id}/apply-telemetry`, {})

export async function sendTelemetry(payload, batteryPassportId) {
  await post('/api/telemetry', { ...payload, batteryPassportId })
  await refresh()
}

function subscribe(listener) {
  if (listeners.size === 0) refresh()
  listeners.add(listener)
  const timer = setInterval(refresh, POLL_MS)
  return () => {
    listeners.delete(listener)
    clearInterval(timer)
  }
}

export const useBatteries = () => useSyncExternalStore(subscribe, () => state)

// The refresh also cancels any older poll, which could still hold the list without this scan.
export async function addScan(passportId) {
  await post('/api/me/batteries', { passportId })
  await refresh()
}
