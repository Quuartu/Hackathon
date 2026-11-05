import { useSyncExternalStore } from 'react'

export const ROLES = {
  manufacturer: { label: 'Battery Manufacturer', text: 'Create batteries, manage their passports and handle garage requests.' },
  garage: { label: 'Garage', text: 'Scan a battery, review it and report it out of service.' },
  customer: { label: 'Customer', text: 'Scan your battery and check its passport.' },
  sorting: { label: 'Sorting Centre', text: 'Scan a received battery and check its status.' },
}

const SESSION_KEY = 'battery-passport-session'
export const UNREACHABLE = 'Cannot reach the database. Check that the API is running (npm run server).'

// sessionStorage is per tab, so each role can stay logged in in its own tab during the demo.
function loadSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY))
    return ROLES[stored?.role] && stored.token ? stored : null
  } catch {
    return null
  }
}

let session = loadSession()
const listeners = new Set()

function setSession(next) {
  session = next
  try {
    if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage blocked: the session lasts until the page reloads.
  }
  listeners.forEach((listener) => listener())
}

export const authHeaders = () => (session ? { Authorization: `Bearer ${session.token}` } : {})
export const currentToken = () => session?.token

export async function post(url, body) {
  let response
  let result
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    })
    result = await response.json()
  } catch {
    throw new Error(UNREACHABLE)
  }
  if (!response.ok) throw new Error(result.error)
  return result
}

export const signUp = async (details) => setSession(await post('/api/auth/signup', details))

export const logIn = async (email, password) => setSession(await post('/api/auth/login', { email, password }))

// Demo mode logs in with a test account, so the API needs no way around its role checks.
export const demoLogIn = (role) => logIn(`${role}1@demo.example`, 'demo1234')

export function logOut() {
  post('/api/auth/logout', {}).catch(() => {
    // The session ends in this tab anyway.
  })
  setSession(null)
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSession = () => useSyncExternalStore(subscribe, () => session)
