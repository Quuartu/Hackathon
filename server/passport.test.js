import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseNewBattery, toBattery } from './passport.js'

const wasteRequest = (status) => ({
  requestId: 'R1',
  reason: 'Defect',
  status,
  createdAt: '2027-01-01T10:00:00Z',
})

const row = (battery, requests = []) => ({
  b: {
    batteryId: 'BAT-0001',
    batteryPassportId: 'BP-2027-0001',
    status: 'Original',
    manufacturingDate: '2025-03',
    dateOfPuttingIntoService: '2025-06',
    statusChangedAt: null,
    ...battery,
  },
  requests,
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

test('modules come out in order and alerts newest first', () => {
  const battery = toBattery({
    ...row(),
    modules: [{ index: 2, name: 'Module 2' }, { index: 1, name: 'Module 1' }],
    alerts: [
      { message: 'old', createdAt: '2027-01-01T10:00:00Z' },
      { message: 'new', createdAt: '2027-01-02T10:00:00Z' },
    ],
  })
  assert.deepEqual(battery.modules.map((m) => m.name), ['Module 1', 'Module 2'])
  assert.equal(battery.alerts[0].message, 'new')
})

const newBattery = {
  modelId: 'MDL-NMC-75',
  operatorName: 'VoltaDrive Manufacturing',
  batteryId: ' bat-0002 ',
  passportId: 'BP-2027-0002',
  manufacturingDate: '2025-09',
  serviceDate: '2025-12',
  warranty: '2033-12',
}

test('a valid new battery is accepted, with IDs cleaned up', () => {
  const { values, error } = parseNewBattery(newBattery)
  assert.equal(error, undefined)
  assert.equal(values.batteryId, 'BAT-0002')
})

test('invalid new batteries are refused', () => {
  const refused = (change) => parseNewBattery({ ...newBattery, ...change }).error
  assert.ok(refused({ modelId: '' }))
  assert.ok(refused({ batteryId: 'BAT/0002' }))
  assert.ok(refused({ passportId: 5 }))
  assert.ok(refused({ warranty: '2033-13' }))
  assert.ok(refused({ serviceDate: '2025-01' }))
  assert.ok(refused({ warranty: '2025-10' }))
})

test('a pending WasteRequest on an Original battery is a pending request', () => {
  const battery = toBattery(row({}, [wasteRequest('Pending')]))
  assert.deepEqual(battery.request, { id: 'R1', reason: 'Defect', at: '2027-01-01T10:00:00Z' })
  assert.equal(battery.history.at(-1).text, 'Reported out of service: Defect')
})

test('a Waste battery has no pending request but keeps its history', () => {
  const battery = toBattery(row(
    { status: 'Waste', statusChangedAt: '2027-01-02T10:00:00Z' },
    [wasteRequest('Approved')],
  ))
  assert.equal(battery.request, null)
  assert.equal(battery.history.length, 5)
  assert.equal(battery.history.at(-2).text, 'Status changed: Original → Waste')
})
