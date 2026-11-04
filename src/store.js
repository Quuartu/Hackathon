import { useSyncExternalStore } from 'react'

export function findBattery(batteries, code) {
  const wanted = code.trim().toLowerCase()
  return batteries.find((b) =>
    [b.batteryId, b.batteryPassportId].some((id) => id.toLowerCase() === wanted),
  )
}

export function generateUniquePassportId(existing) {
  const existingSet =
    existing instanceof Set
      ? existing
      : new Set(
          (existing ?? []).flatMap((b) =>
            [b?.batteryPassportId, b?.batteryId].filter(Boolean).map((id) => id.toUpperCase()),
          ),
        )

  const bytes = new Uint8Array(3)
  for (let attempts = 0; attempts < 1000; attempts++) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes)
    } else {
      for (let j = 0; j < 3; j++) bytes[j] = Math.floor(Math.random() * 256)
    }
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const candidate = `BP-FR-${hex}`
    if (!existingSet.has(candidate)) {
      return candidate
    }
  }
  return `BP-FR-${Date.now().toString(16).slice(-6).toUpperCase()}`
}

// ponytail: polling is enough for the demo, push updates only if 5 seconds of delay becomes a problem
const POLL_MS = 5000
const UNREACHABLE = 'Cannot reach the database. Check that the API is running (npm run server).'

let state = { batteries: null, error: '', saving: false }
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
    const response = await fetch('/api/batteries')
    if (!response.ok) throw new Error()
    change = { batteries: await response.json(), error: '' }
  } catch {
    change = { error: UNREACHABLE }
  }
  // An older poll must not overwrite the result of a newer one.
  if (ticket === latestRefresh) setState(change)
}

async function act(path, body = {}) {
  setState({ saving: true })
  let failure = ''
  try {
    const response = await fetch(`/api/batteries/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) failure = (await response.json()).error
  } catch {
    failure = UNREACHABLE
  }
  await refresh()
  setState({ saving: false, ...(failure && { error: failure }) })
}

export const reportOutOfService = (id, reason) => act(`${id}/report`, { reason })
export const approveWaste = (id) => act(`${id}/approve-waste`)

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
