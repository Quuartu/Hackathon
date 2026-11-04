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
RETURN b { .*, statusChangedAt: toString(b.statusChangedAt), reportedAt: toString(b.reportedAt) } AS b,
       t.name AS type, mo { .* } AS mo, op { .* } AS op, sp { .* } AS sp, sd { .* } AS sd, cf { .* } AS cf,
       co { .* } AS co, an { .* } AS an, ca { .* } AS ca, el { .* } AS el, dp { .* } AS dp, dd { .* } AS dd,
       COLLECT {
         MATCH (b)-[:HAS_MODULE]->(m:Module)
         RETURN m { .name, .initialResistanceMohm, .lastResistanceMohm, .lastIncreasePct, .lastLevel }
         ORDER BY m.index
       } AS modules,
       COLLECT {
         MATCH (b)-[:HAS_MODULE]->(m:Module)-[:HAS_ALERT]->(a:Alert)
         RETURN a { .level, .message, module: m.name, createdAt: toString(a.createdAt) }
         ORDER BY a.createdAt DESC
       } AS alerts
ORDER BY b.batteryId`

// The WHERE clauses are the status rules: no match means the action no longer applies.
export const REPORT = `
MATCH (b:BatteryInstance {batteryId: $id, status: 'Original'})
WHERE b.reportedAt IS NULL
SET b.reportedReason = $reason, b.reportedAt = datetime()
RETURN b.batteryId AS batteryId`

export const APPROVE = `
MATCH (b:BatteryInstance {batteryId: $id, status: 'Original'})
WHERE b.reportedAt IS NOT NULL
SET b.status = 'Waste', b.statusChangedAt = datetime()
RETURN b.batteryId AS batteryId`

// Shapes one LIST row for the screens in src/App.jsx.
export function toBattery({ b, type, mo, op, sp, sd, cf, co, an, ca, el, dp, dd, modules, alerts }) {
  const history = [
    { at: b.manufacturingDate, actor: 'Manufacturer', text: 'Battery manufactured' },
    { at: b.dateOfPuttingIntoService, actor: 'Manufacturer', text: 'Put into service' },
  ]
  if (b.reportedAt) {
    history.push({ at: b.reportedAt, actor: 'Garage', text: `Reported out of service: ${b.reportedReason}` })
  }
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
    modules: modules.map((m) => ({
      name: m.name,
      initialMohm: m.initialResistanceMohm,
      nowMohm: m.lastResistanceMohm,
      increasePct: m.lastIncreasePct,
      level: m.lastLevel,
    })),
    alerts,
    request: b.status === 'Original' && b.reportedAt ? { reason: b.reportedReason, at: b.reportedAt } : null,
    history,
  }
}
