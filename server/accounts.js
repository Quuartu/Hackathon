import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { MongoClient } from 'mongodb'

const derive = promisify(scrypt)
const KEY_LENGTH = 64
const MIN_PASSWORD = 8
const MAX_PASSWORD = 200
const MAX_EMAIL = 254

export const ROLES = ['manufacturer', 'garage', 'customer', 'sorting']
export const SCANNING_ROLES = ['garage', 'customer', 'sorting']

// Who may call each route that changes battery data.
export const WRITE_ROLES = {
  create: ['manufacturer'],
  report: ['garage'],
  'approve-waste': ['manufacturer'],
  'apply-telemetry': ['garage', 'manufacturer'],
}

export const TEST_PASSWORD = 'demo1234'
export const TEST_ACCOUNTS = ROLES.flatMap((role) =>
  [1, 2, 3].map((number) => ({
    email: `${role}${number}@demo.example`,
    role,
    company: role === 'manufacturer' ? 'VoltaDrive' : null,
  })),
)

export function openAccounts(uri) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  return { client, accounts: client.db('battery_passport').collection('accounts') }
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = await derive(password, salt, KEY_LENGTH)
  return `${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const key = await derive(password, salt, KEY_LENGTH)
  return timingSafeEqual(key, Buffer.from(hash, 'hex'))
}

const normalizeEmail = (email) => email.trim().toLowerCase()

// Strings only: an object here, like { "$ne": null }, would become a MongoDB operator.
export function parseLogin({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string') return { error: 'Enter an email and a password.' }
  return { values: { email: normalizeEmail(email), password } }
}

export function parseSignUp({ email, password, role, company }, companyNames) {
  const { values, error } = parseLogin({ email, password })
  if (error) return { error }
  if (values.email.length > MAX_EMAIL || !/^[^\s@]+@[^\s@]+$/.test(values.email)) return { error: 'Enter a valid email.' }
  if (password.length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters.` }
  if (password.length > MAX_PASSWORD) return { error: `Password must be at most ${MAX_PASSWORD} characters.` }
  if (!ROLES.includes(role)) return { error: 'Choose an account type.' }
  const isManufacturer = role === 'manufacturer'
  if (isManufacturer && !companyNames.includes(company)) return { error: 'Choose a company.' }
  return { values: { ...values, role, company: isManufacturer ? company : null } }
}

export function parseScan({ passportId }) {
  if (typeof passportId !== 'string' || !/^[A-Z0-9-]{1,40}$/.test(passportId)) return { error: 'Invalid passport ID.' }
  return { values: { passportId } }
}
