// Utility and service buildings (placed as footprints; stored per tile in world.bt / world.bo)
export const BT = {
  1: { id: 1, key: 'coal', name: 'Coal plant', w: 2, d: 2, cost: 3000, upkeep: 120, power: 150, pollute: 35, cat: 'util' },
  2: { id: 2, key: 'wind', name: 'Wind turbine', w: 1, d: 1, cost: 500, upkeep: 10, power: 12, cat: 'util' },
  3: { id: 3, key: 'water', name: 'Water tower', w: 1, d: 1, cost: 800, upkeep: 25, water: 140, radius: 9, cat: 'util' },
  4: { id: 4, key: 'police', name: 'Police station', w: 1, d: 1, cost: 600, upkeep: 40, radius: 8, use: 2, cat: 'svc' },
  5: { id: 5, key: 'fire', name: 'Fire station', w: 1, d: 1, cost: 600, upkeep: 40, radius: 9, use: 2, cat: 'svc' },
  6: { id: 6, key: 'clinic', name: 'Clinic', w: 1, d: 1, cost: 800, upkeep: 50, radius: 9, use: 3, cat: 'svc' },
  7: { id: 7, key: 'school', name: 'School', w: 1, d: 1, cost: 700, upkeep: 45, radius: 8, use: 3, cat: 'svc' },
};
export const BY_KEY = Object.fromEntries(Object.values(BT).map((b) => [b.key, b]));
export const ELEC = { r: [0, 2, 6, 16], c: [0, 2, 6, 18], i: [0, 4, 10, 24] };
export const WATER = { r: [0, 2, 6, 16], c: [0, 1, 4, 12], i: [0, 3, 8, 20] };
