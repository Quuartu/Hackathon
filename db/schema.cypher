// Demo dataset: one company, one model and battery BAT-0001, healthy and in status Original (21 nodes).
// Only for a NEW, empty Neo4j instance. Do not run it on the team's shared database: it is already loaded.
// Paste into the Query editor; each statement ends with a semicolon.

CREATE CONSTRAINT battery_id IF NOT EXISTS FOR (b:BatteryInstance) REQUIRE b.batteryId IS UNIQUE;
CREATE CONSTRAINT passport_id IF NOT EXISTS FOR (b:BatteryInstance) REQUIRE b.batteryPassportId IS UNIQUE;
CREATE CONSTRAINT model_id IF NOT EXISTS FOR (m:Model) REQUIRE m.modelId IS UNIQUE;
CREATE CONSTRAINT module_id IF NOT EXISTS FOR (m:Module) REQUIRE m.moduleId IS UNIQUE;

CREATE (company:Company {name: 'VoltaDrive'})
CREATE (type:Type {name: 'EV Traction Battery'})
CREATE (model:Model {modelId: 'MDL-NMC-75', name: 'VD-75 NMC', batteryCategory: 'EV', batteryMassKg: 420, manufacturingPlace: 'Paris, France'})
CREATE (operator:EconomicOperator {name: 'VoltaDrive Manufacturing', address: '1 Avenue de la Batterie, 75000 Paris', country: 'France',
                                   email: 'contact@voltadrive.example', phone: '+33 1 00 00 00 00', website: 'https://voltadrive.example'})
CREATE (company)-[:HAS_TYPE]->(type)
CREATE (company)-[:HAS_ECONOMIC_OPERATOR]->(operator)
CREATE (type)-[:HAS_MODEL]->(model)

CREATE (model)-[:HAS_STATIC_PERFORMANCE]->(:StaticPerformance {modelId: 'MDL-NMC-75', minimalVoltage: 300, nominalVoltage: 400, maximalVoltage: 420,
                                                               ratedCapacityAh: 200, originalPowerCapabilityW: 150000,
                                                               initialInternalResistanceMohm: 2.5, maxInternalResistanceMohm: 5.0, warnRatio: 0.8})
CREATE (model)-[:HAS_STATIC_DURABILITY]->(:StaticDurability {modelId: 'MDL-NMC-75', expectedBatteryLifetimeCycles: 1500, expectedLifetimeYears: 10.0})
CREATE (model)-[:HAS_CARBON_FOOTPRINT]->(:CarbonFootprint {modelId: 'MDL-NMC-75', carbonFootprintDeclared: 85.0, performanceClass: 'B'})
CREATE (model)-[:HAS_CERTIFICATION]->(:Certification {modelId: 'MDL-NMC-75', euDeclarationOfConformity: 'EU-DoC-2027-0001'})
CREATE (model)-[:HAS_CIRCULARITY]->(:Circularity {modelId: 'MDL-NMC-75', dismantlingGuide: 'https://voltadrive.example/dismantling'})
CREATE (model)-[:HAS_COMPOSITION]->(composition:Composition {modelId: 'MDL-NMC-75', batteryChemistry: 'Li-ion NMC'})
CREATE (composition)-[:HAS_ANODE]->(:Anode {modelId: 'MDL-NMC-75', anodeMaterialsList: ['Graphite'], percentageList: [100], isRenewable: [false]})
CREATE (composition)-[:HAS_CATHODE]->(:Cathode {modelId: 'MDL-NMC-75', cathodeMaterialsList: ['Nickel', 'Manganese', 'Cobalt'], percentageList: [60, 20, 20], isRenewable: [false, false, false]})
CREATE (composition)-[:HAS_ELECTROLYTE]->(:Electrolyte {modelId: 'MDL-NMC-75', electrolyteList: ['LiPF6'], percentageList: [100], isRenewable: [false]})

CREATE (battery:BatteryInstance {batteryId: 'BAT-0001', batteryPassportId: 'BP-2027-0001', status: 'Original', diagnosis: 'OK',
                                 manufacturingDate: '2025-03', dateOfPuttingIntoService: '2025-06'})
CREATE (model)-[:HAS_BATTERY_INSTANCE]->(battery)
CREATE (operator)-[:BUILD]->(battery)
CREATE (battery)-[:HAS_DYNAMIC_DURABILITY]->(:DynamicDurability {batteryId: 'BAT-0001', warranty: '2033-06', accidents: 0, numberOfFullCycles: 612, deepDischargeEvents: 3})
CREATE (battery)-[:HAS_DYNAMIC_PERFORMANCE]->(:DynamicPerformance {batteryId: 'BAT-0001', soh: 78, soc: 62, remainingCapacityAh: 156, temperatureC: 31, internalResistanceIncreasePct: 0.0})
CREATE (battery)-[:HAS_MODULE]->(:Module {moduleId: 'BAT-0001-M1', index: 1, name: 'Module 1', initialResistanceMohm: 2.2})
CREATE (battery)-[:HAS_MODULE]->(:Module {moduleId: 'BAT-0001-M2', index: 2, name: 'Module 2', initialResistanceMohm: 2.5})
CREATE (battery)-[:HAS_MODULE]->(:Module {moduleId: 'BAT-0001-M3', index: 3, name: 'Module 3', initialResistanceMohm: 2.6})
CREATE (battery)-[:HAS_MODULE]->(:Module {moduleId: 'BAT-0001-M4', index: 4, name: 'Module 4', initialResistanceMohm: 2.3})
CREATE (battery)-[:HAS_MODULE]->(:Module {moduleId: 'BAT-0001-M5', index: 5, name: 'Module 5', initialResistanceMohm: 2.7});
