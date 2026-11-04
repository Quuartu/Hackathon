import assert from 'node:assert/strict'
import { test } from 'node:test'
import accounts from './accounts.json' with { type: 'json' }
import { createAccount, ROLES, verifyLogin } from './auth.js'

const details = { email: ' Doc@Garage.example ', password: 'flux-capacitor', role: 'garage' }

test('every account in the file has a valid role and logs in with its own password only', async () => {
  for (const role of Object.keys(ROLES)) {
    assert.ok(accounts.filter((account) => account.role === role).length >= 3, role)
  }
  for (const { email, role, password } of accounts) {
    assert.ok(ROLES[role], `${email} has an unknown role`)
    assert.equal((await verifyLogin(accounts, email, password))?.role, role, email)
    assert.equal(await verifyLogin(accounts, email, `${password}x`), null, email)
  }
})

test('an account added by hand with capitals in its email still logs in and blocks duplicates', async () => {
  const added = { email: 'Mario@Test.example', role: 'owner', password: 'demo1234' }
  assert.equal((await verifyLogin([added], 'mario@test.example', 'demo1234'))?.role, 'owner')
  await assert.rejects(
    createAccount([added], { email: 'mario@test.example', password: 'long-enough-1', role: 'owner' }),
    /already exists/,
  )
})

test('created account logs in with its role and never stores the password', async () => {
  const account = await createAccount([], details)
  assert.equal(account.email, 'doc@garage.example')
  assert.equal(account.role, 'garage')
  assert.ok(!JSON.stringify(account).includes(details.password))

  const found = await verifyLogin([account], 'DOC@garage.example', details.password)
  assert.equal(found.role, 'garage')
})

test('wrong password or unknown email is refused', async () => {
  const account = await createAccount([], details)
  assert.equal(await verifyLogin([account], details.email, 'wrong-password'), null)
  assert.equal(await verifyLogin([account], 'nobody@garage.example', details.password), null)
})

test('sign-up rejects duplicate email, short password and unknown role', async () => {
  const account = await createAccount([], details)
  await assert.rejects(createAccount([account], details), /already exists/)
  await assert.rejects(createAccount([], { ...details, password: 'short' }), /at least 8/)
  await assert.rejects(createAccount([], { ...details, role: 'admin' }), /account type/)
})

test('a manufacturer must choose a company, and other roles do not store one', async () => {
  const maker = { ...details, role: 'manufacturer' }
  await assert.rejects(createAccount([], maker), /Choose a company/)
  assert.equal((await createAccount([], { ...maker, company: 'VoltaDrive' })).company, 'VoltaDrive')
  assert.equal((await createAccount([], { ...details, company: 'VoltaDrive' })).company, undefined)
})

test('every manufacturer test account belongs to a company', () => {
  for (const { email, role, company } of accounts) {
    if (role === 'manufacturer') assert.ok(company, email)
  }
})

test('same password gets a different salt and hash per account', async () => {
  const first = await createAccount([], details)
  const second = await createAccount([], { ...details, email: 'other@garage.example' })
  assert.notEqual(first.salt, second.salt)
  assert.notEqual(first.hash, second.hash)
})
