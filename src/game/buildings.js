// Utility, service, waste and amenity buildings (placed as footprints; stored per tile in world.bt / world.bo)
// cov: [coverageKey, strength]; radius is in tiles; use = power drawn; waste = collection capacity
export const BT = {
  1: { id: 1, key: 'coal', name: 'Coal plant', w: 2, d: 2, cost: 3000, upkeep: 70, power: 150, pollute: 35, pr: 8, cat: 'util' },
  2: { id: 2, key: 'wind', name: 'Wind turbine', w: 1, d: 1, cost: 500, upkeep: 6, power: 12, cat: 'util' },
  3: { id: 3, key: 'water', name: 'Water tower', w: 1, d: 1, cost: 800, upkeep: 18, water: 140, radius: 9, cat: 'util' },
  4: { id: 4, key: 'police', name: 'Police station', w: 1, d: 1, cost: 600, upkeep: 30, radius: 8, use: 2, cov: [['police', 1]], cat: 'svc' },
  5: { id: 5, key: 'fire', name: 'Fire station', w: 1, d: 1, cost: 600, upkeep: 30, radius: 9, use: 2, cov: [['fire', 1]], cat: 'svc' },
  6: { id: 6, key: 'clinic', name: 'Clinic', w: 1, d: 1, cost: 800, upkeep: 38, radius: 9, use: 3, cov: [['health', 1]], cat: 'svc' },
  7: { id: 7, key: 'school', name: 'School', w: 1, d: 1, cost: 700, upkeep: 34, radius: 8, use: 3, cov: [['edu', 1]], cat: 'svc' },
  8: { id: 8, key: 'police2', name: 'Police HQ', w: 2, d: 2, cost: 2400, upkeep: 110, radius: 14, use: 6, cov: [['police', 1.45]], cat: 'svc' },
  9: { id: 9, key: 'fire2', name: 'Fire HQ', w: 2, d: 2, cost: 2400, upkeep: 110, radius: 15, use: 6, cov: [['fire', 1.45]], cat: 'svc' },
  10: { id: 10, key: 'hospital', name: 'Hospital', w: 2, d: 2, cost: 3400, upkeep: 150, radius: 15, use: 10, cov: [['health', 1.5]], cat: 'svc' },
  11: { id: 11, key: 'university', name: 'University', w: 3, d: 3, cost: 6500, upkeep: 250, radius: 16, use: 14, cov: [['edu', 1.5]], cat: 'svc' },
  12: { id: 12, key: 'plaza', name: 'Town plaza', w: 2, d: 2, cost: 900, upkeep: 20, radius: 8, cov: [['fun', 0.8]], cat: 'fun' },
  13: { id: 13, key: 'library', name: 'Library', w: 1, d: 1, cost: 700, upkeep: 30, radius: 9, use: 2, cov: [['edu', 0.6], ['fun', 0.6]], cat: 'fun' },
  14: { id: 14, key: 'museum', name: 'Museum', w: 2, d: 2, cost: 2200, upkeep: 70, radius: 12, use: 4, cov: [['fun', 1], ['edu', 0.3]], cat: 'fun' },
  15: { id: 15, key: 'stadium', name: 'Stadium', w: 3, d: 3, cost: 7000, upkeep: 200, radius: 16, use: 12, cov: [['fun', 1.5]], cat: 'fun' },
  16: { id: 16, key: 'dump', name: 'Landfill', w: 2, d: 2, cost: 1200, upkeep: 35, waste: 120, radius: 12, pollute: 12, pr: 6, cat: 'waste' },
  17: { id: 17, key: 'recycle', name: 'Recycling center', w: 2, d: 2, cost: 3200, upkeep: 100, waste: 260, radius: 14, pollute: 3, pr: 4, use: 8, cat: 'waste' },
  18: { id: 18, key: 'wte', name: 'Waste-to-energy', w: 2, d: 2, cost: 5200, upkeep: 140, waste: 200, radius: 14, power: 40, pollute: 8, pr: 6, cat: 'waste' },
};
export const BY_KEY = Object.fromEntries(Object.values(BT).map((b) => [b.key, b]));
export const ELEC = { r: [0, 2, 6, 16], c: [0, 2, 6, 18], i: [0, 4, 10, 24] };
export const WATER = { r: [0, 2, 6, 16], c: [0, 1, 4, 12], i: [0, 3, 8, 20] };
export const WASTE = { r: [0, 1, 3, 9], c: [0, 2, 5, 14], i: [0, 3, 8, 20] };
