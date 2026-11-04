import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findBattery, generateUniquePassportId } from './store.js'

const id = 'BAT-2023-0001'
const seedBatteries = [{ batteryId: id, batteryPassportId: 'BP-FR-7F3A91' }]

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
