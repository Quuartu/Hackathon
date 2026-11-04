import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toBattery } from './passport.js'

const row = (battery) => ({
  b: {
    batteryId: 'BAT-0001',
    batteryPassportId: 'BP-2027-0001',
    status: 'Original',
    manufacturingDate: '2025-03',
    dateOfPuttingIntoService: '2025-06',
    reportedAt: null,
    statusChangedAt: null,
    ...battery,
  },
  type: 'EV Traction Battery',
  mo: { name: 'VD-75 NMC', modelId: 'MDL-NMC-75' },
  op: { name: 'VoltaDrive', address: 'Paris', country: 'France', email: 'contact@voltadrive.example' },
  sp: { minimalVoltage: 300, nominalVoltage: 400, maximalVoltage: 420 },
  sd: { expectedBatteryLifetimeCycles: 1500 },
  cf: { carbonFootprintDeclared: 85, performanceClass: 'B' },
  co: { batteryChemistry: 'Li-ion NMC' },
  an: { anodeMaterialsList: ['Graphite'] },
  ca: { cathodeMaterialsList: ['Nickel', 'Cobalt'] },
  el: { electrolyteList: ['LiPF6'] },
  dp: { soh: 78, soc: 62 },
  dd: { warranty: '2033-06', accidents: 0, numberOfFullCycles: 612 },
  modules: [{ name: 'Module 3', initialResistanceMohm: 2.6, lastResistanceMohm: 9.95, lastIncreasePct: 282.7, lastLevel: 'CRITICAL' }],
  alerts: [{ level: 'CRITICAL', message: 'High resistance', module: 'Module 3', createdAt: '2027-01-01T10:00:00Z' }],
})

test('maps the graph to the shape the screens read', () => {
  const battery = toBattery(row())
  assert.equal(battery.model.type, 'EV Traction Battery')
  assert.equal(battery.model.voltage.nominal, 400)
  assert.equal(battery.model.composition.cathode, 'Nickel, Cobalt')
  assert.equal(battery.performance.soh, 78)
  assert.equal(battery.modules[0].nowMohm, 9.95)
  assert.equal(battery.modules[0].level, 'CRITICAL')
  assert.equal(battery.alerts[0].module, 'Module 3')
  assert.equal(battery.request, null)
  assert.equal(battery.history.length, 2)
})

test('a report on an Original battery is a pending request', () => {
  const battery = toBattery(row({ reportedAt: '2027-01-01T10:00:00Z', reportedReason: 'Defect' }))
  assert.deepEqual(battery.request, { reason: 'Defect', at: '2027-01-01T10:00:00Z' })
  assert.equal(battery.history.at(-1).text, 'Reported out of service: Defect')
})

test('a Waste battery has no pending request but keeps its history', () => {
  const battery = toBattery(row({
    status: 'Waste',
    reportedAt: '2027-01-01T10:00:00Z',
    reportedReason: 'Defect',
    statusChangedAt: '2027-01-02T10:00:00Z',
  }))
  assert.equal(battery.request, null)
  assert.equal(battery.history.length, 5)
  assert.equal(battery.history.at(-2).text, 'Status changed: Original → Waste')
})
