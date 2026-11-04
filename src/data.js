// Fictional demo data, shaped after the brief's Battery Passport graph model (Figure 1).
const operator = {
  name: 'Voltara Motors',
  address: '12 Rue de la Demo, 92400 Courbevoie',
  country: 'France',
  email: 'passport@voltara.example',
}

const models = {
  nmc: {
    name: 'VX-75 Long Range',
    modelId: 'VX75-NMC',
    type: 'EV battery',
    voltage: { minimal: 280, nominal: 355, maximal: 403 },
    expectedLifetimeCycles: 1500,
    composition: {
      chemistry: 'Lithium-ion NMC',
      anode: 'Graphite, silicon',
      cathode: 'Nickel, manganese, cobalt',
      electrolyte: 'LiPF6 in organic carbonates',
    },
    carbonFootprint: { declared: 72, performanceClass: 'B' },
    extinguishingAgent: 'Water, class D powder',
  },
  lfp: {
    name: 'VX-50 City',
    modelId: 'VX50-LFP',
    type: 'EV battery',
    voltage: { minimal: 260, nominal: 320, maximal: 365 },
    expectedLifetimeCycles: 3000,
    composition: {
      chemistry: 'Lithium-ion LFP',
      anode: 'Graphite',
      cathode: 'Lithium iron phosphate',
      electrolyte: 'LiPF6 in organic carbonates',
    },
    carbonFootprint: { declared: 54, performanceClass: 'A' },
    extinguishingAgent: 'Water',
  },
}

export const seedBatteries = [
  {
    batteryId: 'BAT-2023-0001',
    batteryPassportId: 'BP-FR-7F3A91',
    status: 'Original',
    model: models.nmc,
    operator,
    performance: { soh: 41, soc: 63 },
    durability: { warrantyUntil: '2031-03-14', accidents: 1 },
    request: null,
    history: [
      { at: '2023-03-14T09:00:00Z', actor: 'Manufacturer', text: 'Battery passport created' },
      { at: '2025-06-02T14:30:00Z', actor: 'Garage', text: 'Accident recorded: rear impact' },
    ],
  },
  {
    batteryId: 'BAT-2024-0417',
    batteryPassportId: 'BP-FR-2C88D4',
    status: 'Original',
    model: models.lfp,
    operator,
    performance: { soh: 94, soc: 80 },
    durability: { warrantyUntil: '2032-09-30', accidents: 0 },
    request: null,
    history: [
      { at: '2024-09-30T08:15:00Z', actor: 'Manufacturer', text: 'Battery passport created' },
    ],
  },
  {
    batteryId: 'BAT-2021-0093',
    batteryPassportId: 'BP-FR-A1B5E0',
    status: 'Waste',
    model: models.nmc,
    operator,
    performance: { soh: 32, soc: 12 },
    durability: { warrantyUntil: '2029-01-20', accidents: 2 },
    request: null,
    history: [
      { at: '2021-01-20T10:00:00Z', actor: 'Manufacturer', text: 'Battery passport created' },
      { at: '2026-02-11T16:45:00Z', actor: 'Passport Owner', text: 'Status changed: Original → Waste' },
    ],
  },
]
