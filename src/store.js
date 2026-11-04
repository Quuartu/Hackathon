import { useSyncExternalStore } from 'react'
import { seedBatteries } from './data.js'

const patch = (batteries, id, change) =>
  batteries.map((b) => (b.batteryId === id ? change(b) : b))

export function reportOutOfService(batteries, id, reason, at = new Date().toISOString()) {
  return patch(batteries, id, (b) => {
    if (b.status !== 'Original' || b.request) return b
    return {
      ...b,
      request: { reason, at },
      history: [...b.history, { at, actor: 'Garage', text: `Reported out of service: ${reason}` }],
    }
  })
}

export function approveWaste(batteries, id, at = new Date().toISOString()) {
  return patch(batteries, id, (b) => {
    if (!b.request) return b
    return {
      ...b,
      status: 'Waste',
      request: null,
      history: [
        ...b.history,
        { at, actor: 'Passport Owner', text: 'Status changed: Original → Waste' },
        { at, actor: 'Passport Owner', text: 'Transfer to sorting centre organised' },
      ],
    }
  })
}

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

// ponytail: localStorage syncs the roles across tabs of one browser only, a real API replaces this for multi-device
const KEY = 'battery-passport-demo'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? seedBatteries
  } catch {
    return seedBatteries
  }
}

let batteries = load()
const listeners = new Set()

function commit(next) {
  batteries = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the demo still works for this tab.
  }
  listeners.forEach((listener) => listener())
}

export const update = (change) => commit(change(batteries))
export const resetDemo = () => commit(seedBatteries)

function subscribe(listener) {
  const onStorage = () => {
    batteries = load()
    listener()
  }
  listeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export const useBatteries = () => useSyncExternalStore(subscribe, () => batteries)
