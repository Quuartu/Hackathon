export const LIST = `
MATCH (t:Type)-[:HAS_MODEL]->(mo:Model)-[:HAS_BATTERY_INSTANCE]->(b:BatteryInstance)<-[:BUILD]-(op:EconomicOperator)
MATCH (mo)-[:HAS_STATIC_PERFORMANCE]->(sp:StaticPerformance)
MATCH (mo)-[:HAS_STATIC_DURABILITY]->(sd:StaticDurability)
MATCH (mo)-[:HAS_CARBON_FOOTPRINT]->(cf:CarbonFootprint)
MATCH (mo)-[:HAS_COMPOSITION]->(co:Composition)
MATCH (co)-[:HAS_ANODE]->(an:Anode)
MATCH (co)-[:HAS_CATHODE]->(ca:Cathode)
MATCH (co)-[:HAS_ELECTROLYTE]->(el:Electrolyte)
MATCH (b)-[:HAS_DYNAMIC_PERFORMANCE]->(dp:DynamicPerformance)
MATCH (b)-[:HAS_DYNAMIC_DURABILITY]->(dd:DynamicDurability)
RETURN b { .*, statusChangedAt: toString(b.statusChangedAt) } AS b,
       t.name AS type, mo { .* } AS mo, op { .* } AS op, sp { .* } AS sp, sd { .* } AS sd, cf { .* } AS cf,
       co { .* } AS co, an { .* } AS an, ca { .* } AS ca, el { .* } AS el, dp { .* } AS dp, dd { .* } AS dd,
       COLLECT {
         MATCH (b)-[:HAS_MODULE]->(m:Module)
         RETURN m { .index, .name, .initialResistanceMohm, .lastResistanceMohm, .lastIncreasePct, .lastLevel }
       } AS modules,
       COLLECT {
         MATCH (b)-[:HAS_MODULE]->(m:Module)-[:HAS_ALERT]->(a:Alert)
         RETURN a { .level, .message, module: m.name, createdAt: toString(a.createdAt) }
       } AS alerts,
       COLLECT {
         MATCH (b)-[:HAS_WASTE_REQUEST]->(w:WasteRequest)
         RETURN w { .requestId, .reason, .status, createdAt: toString(w.createdAt) }
       } AS requests
ORDER BY b.batteryId`

export const COMPANIES = `
MATCH (c:Company)
RETURN c.name AS name,
       COLLECT { MATCH (c)-[:HAS_ECONOMIC_OPERATOR]->(op:EconomicOperator) RETURN op.name } AS operators,
       COLLECT { MATCH (c)-[:HAS_TYPE]->(:Type)-[:HAS_MODEL]->(mo:Model) RETURN mo.modelId } AS models
ORDER BY name`

// Query N in db/queries.cypher.
export const CREATE_BATTERY = `
MATCH (mo:Model {modelId: $modelId})
MATCH (op:EconomicOperator {name: $operatorName})
MATCH (mo)-[:HAS_STATIC_PERFORMANCE]->(sp:StaticPerformance)
CREATE (b:BatteryInstance {batteryId: $batteryId, batteryPassportId: $passportId, status: 'Original', diagnosis: 'OK',
                           manufacturingDate: $manufacturingDate, dateOfPuttingIntoService: $serviceDate})
CREATE (mo)-[:HAS_BATTERY_INSTANCE]->(b)
CREATE (op)-[:BUILD]->(b)
CREATE (dd:DynamicDurability {batteryId: $batteryId, warranty: $warranty, accidents: 0, numberOfFullCycles: 0, deepDischargeEvents: 0})
CREATE (b)-[:HAS_DYNAMIC_DURABILITY]->(dd)
CREATE (dp:DynamicPerformance {batteryId: $batteryId, soh: 100, soc: 100, remainingCapacityAh: sp.ratedCapacityAh,
                               temperatureC: 25, internalResistanceIncreasePct: 0.0})
CREATE (b)-[:HAS_DYNAMIC_PERFORMANCE]->(dp)
WITH b, sp
UNWIND range(1, 5) AS i
CREATE (m:Module {moduleId: $batteryId + '-M' + toString(i), index: i, name: 'Module ' + toString(i),
                  initialResistanceMohm: sp.initialInternalResistanceMohm})
CREATE (b)-[:HAS_MODULE]->(m)
RETURN b.batteryId AS batteryId, b.batteryPassportId AS passportId, count(m) AS modules`

const ID_FORMAT = /^[A-Z0-9-]{1,40}$/
const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/

// Checks the fields for CREATE_BATTERY. IDs also go in URLs and QR codes, so they stay simple.
export function parseNewBattery(body) {
  const text = (value) => (typeof value === 'string' ? value.trim() : '')
  const values = {
    modelId: text(body.modelId),
    operatorName: text(body.operatorName),
    batteryId: text(body.batteryId).toUpperCase(),
    passportId: text(body.passportId).toUpperCase(),
    manufacturingDate: text(body.manufacturingDate),
    serviceDate: text(body.serviceDate),
    warranty: text(body.warranty),
  }
  if (!values.modelId || !values.operatorName) return { error: 'Choose a model and an operator.' }
  if (!ID_FORMAT.test(values.batteryId) || !ID_FORMAT.test(values.passportId)) {
    return { error: 'IDs can only use letters, numbers and hyphens, up to 40 characters.' }
  }
  const dates = [values.manufacturingDate, values.serviceDate, values.warranty]
  if (!dates.every((date) => MONTH_FORMAT.test(date))) return { error: 'Enter the dates as year and month.' }
  if (dates[0] > dates[1] || dates[1] > dates[2]) {
    return { error: 'The dates must be in order: manufacturing, service, warranty.' }
  }
  return { values }
}

const time = (value) => new Date(value).getTime()

// Query K in db/queries.cypher, plus the status rules: no match means the action no longer applies.
export const REPORT = `
MATCH (b:BatteryInstance {batteryId: $id, status: 'Original'})
WHERE NOT EXISTS { (b)-[:HAS_WASTE_REQUEST]->(:WasteRequest {status: 'Pending'}) }
CREATE (r:WasteRequest {requestId: randomUUID(), createdAt: datetime(), reason: $reason, status: 'Pending'})
CREATE (b)-[:HAS_WASTE_REQUEST]->(r)
RETURN r.requestId AS requestId`

// Query M in db/queries.cypher.
export const APPROVE = `
MATCH (b:BatteryInstance {batteryId: $id, status: 'Original'})-[:HAS_WASTE_REQUEST]->(r:WasteRequest {requestId: $requestId, status: 'Pending'})
SET b.status = 'Waste', b.statusChangedAt = datetime(), r.status = 'Approved', r.resolvedAt = datetime()
RETURN b.status AS status`

// Shapes one LIST row for the screens in src/App.jsx.
export function toBattery({ b, type, mo, op, sp, sd, cf, co, an, ca, el, dp, dd, modules, alerts, requests: unsorted }) {
  // Subquery results can come back in any order, so they are sorted here.
  const requests = [...unsorted].sort((x, y) => time(x.createdAt) - time(y.createdAt))
  const pending = requests.find((r) => r.status === 'Pending')
  const history = [
    { at: b.manufacturingDate, actor: 'Manufacturer', text: 'Battery manufactured' },
    { at: b.dateOfPuttingIntoService, actor: 'Manufacturer', text: 'Put into service' },
    ...requests.map((r) => ({ at: r.createdAt, actor: 'Garage', text: `Reported out of service: ${r.reason}` })),
  ]
  if (b.statusChangedAt) {
    history.push(
      { at: b.statusChangedAt, actor: 'Passport Owner', text: `Status changed: Original → ${b.status}` },
      { at: b.statusChangedAt, actor: 'Passport Owner', text: 'Transfer to sorting centre organised' },
    )
  }

  return {
    batteryId: b.batteryId,
    batteryPassportId: b.batteryPassportId,
    status: b.status,
    diagnosis: b.diagnosis,
    model: {
      name: mo.name,
      modelId: mo.modelId,
      type,
      voltage: { minimal: sp.minimalVoltage, nominal: sp.nominalVoltage, maximal: sp.maximalVoltage },
      expectedLifetimeCycles: sd.expectedBatteryLifetimeCycles,
      composition: {
        chemistry: co.batteryChemistry,
        anode: an.anodeMaterialsList.join(', '),
        cathode: ca.cathodeMaterialsList.join(', '),
        electrolyte: el.electrolyteList.join(', '),
      },
      carbonFootprint: { declared: cf.carbonFootprintDeclared, performanceClass: cf.performanceClass },
      // ponytail: the graph has no extinguishing agent yet, read it from Neo4j once it is added
      extinguishingAgent: 'Not recorded',
    },
    operator: { name: op.name, address: op.address, country: op.country, email: op.email },
    performance: {
      soh: dp.soh,
      soc: dp.soc,
      temperatureC: dp.temperatureC,
      resistanceIncreasePct: dp.internalResistanceIncreasePct,
    },
    durability: { warrantyUntil: dd.warranty, accidents: dd.accidents, fullCycles: dd.numberOfFullCycles },
    modules: [...modules].sort((x, y) => x.index - y.index).map((m) => ({
      name: m.name,
      initialMohm: m.initialResistanceMohm,
      nowMohm: m.lastResistanceMohm,
      increasePct: m.lastIncreasePct,
      level: m.lastLevel,
    })),
    alerts: [...alerts].sort((x, y) => time(y.createdAt) - time(x.createdAt)),
    request: b.status === 'Original' && pending
      ? { id: pending.requestId, reason: pending.reason, at: pending.createdAt }
      : null,
    history,
  }
}
