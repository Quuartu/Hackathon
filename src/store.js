import { useSyncExternalStore } from 'react'

export function findBattery(batteries, code) {
  const wanted = code.trim().toLowerCase()
  return batteries.find((b) =>
    [b.batteryId, b.batteryPassportId].some((id) => id.toLowerCase() === wanted),
  )
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
const UNREACHABLE = 'Cannot reach the database. Check that the API is running (npm run server).'

let state = { batteries: null, companies: [], error: '', saving: false }
let latestRefresh = 0
const listeners = new Set()

function setState(change) {
  state = { ...state, ...change }
  listeners.forEach((listener) => listener())
}

async function refresh() {
  const ticket = ++latestRefresh
  let change
  try {
    const responses = await Promise.all([fetch('/api/batteries'), fetch('/api/companies')])
    if (!responses.every((response) => response.ok)) throw new Error()
    const [batteries, companies] = await Promise.all(responses.map((response) => response.json()))
    change = { batteries, companies, error: '' }
  } catch {
    change = { error: UNREACHABLE }
  }
  // An older poll must not overwrite the result of a newer one.
  if (ticket === latestRefresh) setState(change)
}

async function post(url, body) {
  let response
  let result
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    result = await response.json()
  } catch {
    throw new Error(UNREACHABLE)
  }
  if (!response.ok) throw new Error(result.error)
  return result
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

export async function sendTelemetry(payload, id = 'BAT-0001') {
  await post('/api/telemetry', { ...payload, batteryId: id })
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

// ponytail: each account's scans stay in this browser with the account itself, so they do not follow it to another device
const scansKey = (email) => `battery-passport-scans:${email}`
const scanCache = new Map()
const scanListeners = new Set()

export function readScans(email) {
  if (!scanCache.has(email)) {
    let saved = []
    try {
      saved = JSON.parse(localStorage.getItem(scansKey(email))) ?? []
    } catch {
      // Storage blocked: the list lasts until the page reloads.
    }
    scanCache.set(email, saved)
  }
  return scanCache.get(email)
}

export function addScan(email, id) {
  const next = [id, ...readScans(email).filter((scanned) => scanned !== id)]
  scanCache.set(email, next)
  try {
    localStorage.setItem(scansKey(email), JSON.stringify(next))
  } catch {
    // Storage blocked: the list lasts until the page reloads.
  }
  scanListeners.forEach((listener) => listener())
}

function subscribeScans(listener) {
  const onStorage = () => {
    scanCache.clear()
    listener()
  }
  scanListeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    scanListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export const useScans = (email) => useSyncExternalStore(subscribeScans, () => readScans(email))
