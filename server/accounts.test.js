import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  hashPassword,
  parseLogin,
  parseScan,
  parseSignUp,
  ROLES,
  TEST_ACCOUNTS,
  verifyPassword,
  WRITE_ROLES,
} from './accounts.js'

const companies = ['VoltaDrive']
const details = { email: ' Doc@Garage.example ', password: 'flux-capacitor', role: 'garage' }

test('a password checks out only against its own hash, and is never stored in clear', async () => {
  const stored = await hashPassword('flux-capacitor')
  assert.ok(!stored.includes('flux-capacitor'))
  assert.equal(await verifyPassword('flux-capacitor', stored), true)
  assert.equal(await verifyPassword('flux-capacitor!', stored), false)
})

test('the same password gets a different hash each time', async () => {
  assert.notEqual(await hashPassword('flux-capacitor'), await hashPassword('flux-capacitor'))
})

test('login only accepts strings, so a MongoDB operator cannot match an account', () => {
  assert.ok(parseLogin({ email: { $ne: null }, password: 'x' }).error)
  assert.ok(parseLogin({ email: 'a@b.example', password: { $ne: null } }).error)
  assert.equal(parseLogin({ email: ' A@B.example ', password: 'x' }).values.email, 'a@b.example')
})

test('sign-up normalizes the email and refuses bad input', () => {
  assert.equal(parseSignUp(details, companies).values.email, 'doc@garage.example')
  assert.ok(parseSignUp({ ...details, email: 'not-an-email' }, companies).error)
  assert.match(parseSignUp({ ...details, password: 'short' }, companies).error, /at least 8/)
  assert.match(parseSignUp({ ...details, password: 'x'.repeat(201) }, companies).error, /at most 200/)
  assert.match(parseSignUp({ ...details, role: 'admin' }, companies).error, /account type/)
})

test('a manufacturer needs a company from the database, and other roles store none', () => {
  const maker = { ...details, role: 'manufacturer' }
  assert.match(parseSignUp(maker, companies).error, /Choose a company/)
  assert.match(parseSignUp({ ...maker, company: 'Unknown' }, companies).error, /Choose a company/)
  assert.equal(parseSignUp({ ...maker, company: 'VoltaDrive' }, companies).values.company, 'VoltaDrive')
  assert.equal(parseSignUp({ ...details, company: 'VoltaDrive' }, companies).values.company, null)
})

test('a scan only accepts a plain passport ID', () => {
  assert.equal(parseScan({ passportId: 'BP-2027-0001' }).values.passportId, 'BP-2027-0001')
  for (const passportId of ['', '$where', 'a b', { $ne: null }, undefined, 'X'.repeat(41)]) {
    assert.ok(parseScan({ passportId }).error, String(passportId))
  }
})

test('only a garage reports, only a manufacturer creates and approves', () => {
  assert.deepEqual(WRITE_ROLES.report, ['garage'])
  assert.deepEqual(WRITE_ROLES.create, ['manufacturer'])
  assert.deepEqual(WRITE_ROLES['approve-waste'], ['manufacturer'])
  assert.deepEqual(WRITE_ROLES['apply-telemetry'], ['garage', 'manufacturer'])
})

test('there are three test accounts per role, and every manufacturer has a company', () => {
  for (const role of ROLES) assert.equal(TEST_ACCOUNTS.filter((account) => account.role === role).length, 3)
  for (const { email, role, company } of TEST_ACCOUNTS) assert.equal(Boolean(company), role === 'manufacturer', email)
})
