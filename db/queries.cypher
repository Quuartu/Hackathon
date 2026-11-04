// ============================================================
// Handy queries - paste ONE at a time into the Query editor
// ============================================================

// A. Look at the whole schema
CALL db.schema.visualization();

// B. Count nodes per label (expect Module = 5, everything else 1)
MATCH (n) RETURN labels(n) AS label, count(*) AS total ORDER BY total DESC;

// C. Mechanic screen - battery card
MATCH (mo:Model)-[:HAS_BATTERY_INSTANCE]->(b:BatteryInstance {batteryPassportId: 'BP-2027-0001'})
MATCH (mo)-[:HAS_STATIC_PERFORMANCE]->(sp:StaticPerformance)
MATCH (mo)-[:HAS_COMPOSITION]->(co:Composition)
MATCH (b)-[:HAS_DYNAMIC_PERFORMANCE]->(dp:DynamicPerformance)
MATCH (b)-[:HAS_DYNAMIC_DURABILITY]->(dd:DynamicDurability)
RETURN b.batteryId AS batteryId, b.batteryPassportId AS passportId, b.status AS status,
       b.diagnosis AS diagnosis, mo.name AS model, mo.batteryCategory AS category,
       co.batteryChemistry AS chemistry, b.manufacturingDate AS manufacturingDate,
       dp.soh AS soh, dp.soc AS soc, dp.temperatureC AS temperatureC,
       dp.internalResistanceIncreasePct AS resistanceIncreasePct,
       dd.numberOfFullCycles AS cycles, dd.accidents AS accidents, dd.warranty AS warranty,
       sp.nominalVoltage AS nominalVoltage, sp.maxInternalResistanceMohm AS maxResistanceMohm;

// D. Mechanic screen - the 5 module gauges
MATCH (b:BatteryInstance {batteryId: 'BAT-0001'})-[:HAS_MODULE]->(m:Module)
RETURN m.name AS module, m.initialResistanceMohm AS initialMohm, m.lastResistanceMohm AS nowMohm,
       m.lastIncreasePct AS increasePct, m.lastLevel AS level, m.lastReadingAt AS lastReadingAt
ORDER BY m.index;

// E. Mechanic screen - alerts
MATCH (b:BatteryInstance {batteryId: 'BAT-0001'})-[:HAS_MODULE]->(m:Module)-[:HAS_ALERT]->(a:Alert)
RETURN m.name AS module, a.level AS level, a.message AS message, a.resistanceMohm AS resistanceMohm, a.createdAt AS createdAt
ORDER BY a.createdAt DESC;

// F. History of one module (for a chart)
MATCH (m:Module {moduleId: 'BAT-0001-M3'})-[:HAS_READING]->(r:Reading)
RETURN r.timestamp AS time, r.resistanceMohm AS resistanceMohm, r.increasePct AS increasePct, r.level AS level
ORDER BY r.timestamp;

// G. See the whole battery as a graph picture (switch results to Graph view)
MATCH p = (b:BatteryInstance {batteryId: 'BAT-0001'})-[*1..2]-(x) RETURN p;

// H. Owner action (core use case): Original -> Waste. Run ONLY in the final demo.
MATCH (b:BatteryInstance {batteryPassportId: 'BP-2027-0001', status: 'Original'})
SET b.status = 'Waste', b.statusChangedAt = datetime()
RETURN b.batteryPassportId AS passportId, b.status AS status;

// I. Replay the demo: reset BAT-0001 only (status, readings, alerts)
MATCH (b:BatteryInstance {batteryId: 'BAT-0001'})-[:HAS_DYNAMIC_PERFORMANCE]->(dp:DynamicPerformance)
SET b.status = 'Original', b.diagnosis = 'OK', dp.internalResistanceIncreasePct = 0.0
REMOVE b.statusChangedAt
WITH b
MATCH (b)-[:HAS_MODULE]->(m:Module)
REMOVE m.lastResistanceMohm, m.lastLevel, m.lastReadingAt, m.lastIncreasePct
WITH m
OPTIONAL MATCH (m)-[:HAS_READING]->(r:Reading)
OPTIONAL MATCH (m)-[:HAS_ALERT]->(a:Alert)
DETACH DELETE r, a;

// J. WIPE EVERYTHING. Only on this dedicated hackathon instance, and only when you want a clean start.
MATCH (n) DETACH DELETE n;
