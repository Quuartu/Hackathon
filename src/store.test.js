import assert from 'node:assert/strict'
import { test } from 'node:test'
import { seedBatteries } from './data.js'
import { approveWaste, findBattery, generateUniquePassportId, reportOutOfService } from './store.js'

const id = 'BAT-2023-0001'
const get = (batteries, wanted = id) => batteries.find((b) => b.batteryId === wanted)

test('garage report then owner approval moves Original to Waste', () => {
  const reported = reportOutOfService(seedBatteries, id, 'Critical defect')
  assert.equal(get(reported).status, 'Original')
  assert.equal(get(reported).request.reason, 'Critical defect')

  const approved = approveWaste(reported, id)
  assert.equal(get(approved).status, 'Waste')
  assert.equal(get(approved).request, null)
})

test('owner cannot change a status nobody requested', () => {
  assert.equal(get(approveWaste(seedBatteries, id)).status, 'Original')
})

test('garage cannot report a Waste battery or report twice', () => {
  const waste = 'BAT-2021-0093'
  assert.equal(get(reportOutOfService(seedBatteries, waste, 'x'), waste).request, null)

  const once = reportOutOfService(seedBatteries, id, 'first')
  assert.equal(get(reportOutOfService(once, id, 'second')).request.reason, 'first')
})

test('scan matches battery or passport id, ignoring case and spaces', () => {
  assert.equal(findBattery(seedBatteries, ' bat-2023-0001 ').batteryId, id)
  assert.equal(findBattery(seedBatteries, 'bp-fr-7f3a91').batteryId, id)
  assert.equal(findBattery(seedBatteries, 'unknown'), undefined)
})

test('generateUniquePassportId creates a valid BP-FR-XXXXXX code not present in batteries', () => {
  const existingSet = new Set(seedBatteries.map((b) => b.batteryPassportId.toUpperCase()))
  for (let i = 0; i < 20; i++) {
    const code = generateUniquePassportId(seedBatteries)
    assert.match(code, /^BP-FR-[0-9A-F]{6}$/)
    assert.equal(existingSet.has(code), false, `Collision detected with ${code}`)
  }

  // Also verify with explicit Set
  const customSet = new Set(['BP-FR-AAAAAA', 'BP-FR-BBBBBB'])
  const codeFromSet = generateUniquePassportId(customSet)
  assert.match(codeFromSet, /^BP-FR-[0-9A-F]{6}$/)
  assert.equal(customSet.has(codeFromSet), false)
})
