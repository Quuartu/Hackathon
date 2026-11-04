import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addToAccountList, findBattery, nextBatteryIds, readAccountList } from './store.js'

const id = 'BAT-2023-0001'
const seedBatteries = [{ batteryId: id, batteryPassportId: 'BP-FR-7F3A91' }]

test('scan matches battery or passport id, ignoring case and spaces', () => {
  assert.equal(findBattery(seedBatteries, ' bat-2023-0001 ').batteryId, id)
  assert.equal(findBattery(seedBatteries, 'bp-fr-7f3a91').batteryId, id)
  assert.equal(findBattery(seedBatteries, 'unknown'), undefined)
})

test('each account keeps its own lists, newest first and without duplicates', () => {
  addToAccountList('garage1@test', 'scans', 'BAT-1')
  addToAccountList('garage1@test', 'scans', 'BAT-2')
  addToAccountList('garage1@test', 'scans', 'BAT-1')
  assert.deepEqual(readAccountList('garage1@test', 'scans'), ['BAT-1', 'BAT-2'])
  assert.deepEqual(readAccountList('garage2@test', 'scans'), [])
  assert.deepEqual(readAccountList('garage1@test', 'created'), [])
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
