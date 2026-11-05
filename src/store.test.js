import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findBattery, nextBatteryIds } from './store.js'

const id = 'BAT-2023-0001'
const seedBatteries = [{ batteryId: id, batteryPassportId: 'BP-FR-7F3A91' }]

test('scan matches the passport id only, ignoring case and spaces', () => {
  assert.equal(findBattery(seedBatteries, ' bp-fr-7f3a91 ').batteryId, id)
  assert.equal(findBattery(seedBatteries, id), undefined)
  assert.equal(findBattery(seedBatteries, 'unknown'), undefined)
})

test('next IDs follow the highest number in the database', () => {
  assert.deepEqual(nextBatteryIds([]), { batteryId: 'BAT-0001', passportId: 'BP-2027-0001' })
  assert.deepEqual(
    nextBatteryIds([
      { batteryId: 'BAT-0001', batteryPassportId: 'BP-2027-0001' },
      { batteryId: 'BAT-0007', batteryPassportId: 'BP-2027-0003' },
    ]),
    { batteryId: 'BAT-0008', passportId: 'BP-2027-0008' },
  )
})
