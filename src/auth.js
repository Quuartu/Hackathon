import { useSyncExternalStore } from 'react'
import demoAccounts from './accounts.json' with { type: 'json' }

export const ROLES = {
  manufacturer: { label: 'Battery Manufacturer', text: 'Generate a QR code from a passport ID.' },
  garage: { label: 'Garage', text: 'Scan a battery, review it and report it out of service.' },
  owner: { label: 'Passport Owner', text: 'Handle garage requests and update passport status.' },
  sorting: { label: 'Sorting Centre', text: 'Scan a received battery and check its status.' },
}

const ITERATIONS = 600_000
const MIN_PASSWORD_LENGTH = 8

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => Uint8Array.from(hex.match(/../g), (pair) => parseInt(pair, 16))
const normalizeEmail = (email) => email.trim().toLowerCase()

async function hashPassword(password, salt) {
  if (!crypto.subtle) throw new Error('This needs HTTPS or localhost.')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations: ITERATIONS },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

export async function createAccount(accounts, { email, password, role, company }) {
  const normalized = normalizeEmail(email)
  if (!ROLES[role]) throw new Error('Choose an account type.')
  if (role === 'manufacturer' && !company) throw new Error('Choose a company.')
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (accounts.some((account) => normalizeEmail(account.email) === normalized)) {
    throw new Error('An account with this email already exists.')
  }
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  const hash = await hashPassword(password, salt)
  return { email: normalized, role, ...(role === 'manufacturer' && { company }), salt, hash }
}

export async function verifyLogin(accounts, email, password) {
  const account = accounts.find((a) => normalizeEmail(a.email) === normalizeEmail(email))
  if (!account) return null
  // Test accounts in accounts.json keep their password in plain text so the team can read and edit them.
  if (account.password !== undefined) return account.password === password ? account : null
  return (await hashPassword(password, account.salt)) === account.hash ? account : null
}

// ponytail: accounts live in this browser and checks run client-side, so this is demo-only; a real API must own auth
const ACCOUNTS_KEY = 'battery-passport-accounts'
const SESSION_KEY = 'battery-passport-session'

function loadAccounts() {
  try {
    return [...demoAccounts, ...(JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) ?? [])]
  } catch {
    return demoAccounts
  }
}

function saveAccounts(created) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(created))
  } catch {
    // Storage blocked: the session still works until the tab closes.
  }
}

// sessionStorage is per tab, so each role can stay logged in in its own tab during the demo.
function loadSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY))
    return ROLES[stored?.role] ? stored : null
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

const startSession = ({ email, role, company }) => setSession({ email, role, company })

export async function signUp(details) {
  const accounts = loadAccounts()
  const account = await createAccount(accounts, details)
  const created = accounts.filter((a) => !demoAccounts.includes(a))
  saveAccounts([...created, account])
  startSession(account)
}

export async function logIn(email, password) {
  const account = await verifyLogin(loadAccounts(), email, password)
  if (!account) throw new Error('Incorrect email or password.')
  startSession(account)
}

export const demoLogIn = (role) => startSession({ email: 'Demo mode', role })

export const logOut = () => setSession(null)

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSession = () => useSyncExternalStore(subscribe, () => session)
