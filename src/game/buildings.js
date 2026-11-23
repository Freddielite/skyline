// Utility, service, waste and amenity buildings (placed as footprints; stored per tile in world.bt / world.bo)
// cov: [coverageKey, strength]; radius is in tiles; use = power drawn; waste = collection capacity
export const BT = {
  1: { id: 1, key: 'coal', name: 'Coal plant', w: 2, d: 2, cost: 3000, upkeep: 70, power: 150, pollute: 35, pr: 8, cat: 'util' },
  2: { id: 2, key: 'wind', name: 'Wind turbine', w: 1, d: 1, cost: 500, upkeep: 6, power: 12, peak: 20, cat: 'util' },
  3: { id: 3, key: 'water', name: 'Water tower', w: 1, d: 1, cost: 800, upkeep: 18, water: 140, cat: 'util' },
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
  19: { id: 19, key: 'pump', name: 'Pumping station', w: 2, d: 2, cost: 2600, upkeep: 90, water: 520, use: 5, cat: 'util' },
  20: { id: 20, key: 'treat', name: 'Water treatment', w: 3, d: 3, cost: 7500, upkeep: 260, water: 1500, use: 14, cat: 'util' },
  21: { id: 21, key: 'busstop', name: 'Bus stop', w: 1, d: 1, cost: 150, upkeep: 4, radius: 6, cov: [['transit', 0.5]], road: true, cat: 'transit' },
  22: { id: 22, key: 'busterm', name: 'Bus terminal', w: 2, d: 2, cost: 2200, upkeep: 100, radius: 12, use: 4, cov: [['transit', 1.2]], road: true, cat: 'transit' },
  // On the shore (shore: 'water' any pond or bigger, 'lake' a lake or the sea, 'sand' on a beach). The footprint is on land and the
  // structure reaches out over `reach` rows of water in front; `dock` needs one more row of open water where boats tie up.
  23: { id: 23, key: 'pier', name: 'Fishing pier', w: 1, d: 1, cost: 400, upkeep: 8, radius: 6, cov: [['fun', 0.45]], cat: 'fun', shore: 'water', reach: 2 },
  24: { id: 24, key: 'beach', name: 'Beach', w: 2, d: 2, cost: 600, upkeep: 12, radius: 9, cov: [['fun', 0.8]], cat: 'fun', shore: 'sand', reach: 1 },
  25: { id: 25, key: 'marina', name: 'Marina', w: 2, d: 2, cost: 3000, upkeep: 60, radius: 12, use: 3, cov: [['fun', 1.1]], cat: 'fun', shore: 'lake', reach: 2, dock: true },
  26: { id: 26, key: 'ferry', name: 'Ferry pier', w: 1, d: 1, cost: 1500, upkeep: 40, radius: 11, use: 2, cov: [['transit', 1]], cat: 'transit', shore: 'lake', reach: 1, dock: true, road: true, ferry: true },
  27: { id: 27, key: 'metro', name: 'Metro station', w: 1, d: 1, cost: 5000, upkeep: 120, radius: 10, use: 4, cov: [['metro', 1]], road: true, metro: true, cat: 'transit' },
  // bigger power for a growing city: gas, solar and nuclear (nuclear is a 4x4)
  28: { id: 28, key: 'gas', name: 'Gas power plant', w: 3, d: 3, cost: 9000, upkeep: 260, power: 520, pollute: 14, pr: 9, cat: 'util' },
  29: { id: 29, key: 'solar', name: 'Solar farm', w: 3, d: 3, cost: 7000, upkeep: 60, power: 160, peak: 320, cat: 'util' },
  30: { id: 30, key: 'nuclear', name: 'Nuclear power plant', w: 4, d: 4, cost: 32000, upkeep: 900, power: 2400, pollute: 3, pr: 6, cat: 'util' },
  // the bigger waste tier (0.8.10): one big complex for a grown city, and small transfer stations that collect around them and
  // truck the garbage by road to any landfill, recycling center, waste-to-energy plant or complex that still has room
  31: { id: 31, key: 'xfer', name: 'Transfer station', w: 1, d: 1, cost: 900, upkeep: 25, radius: 10, xfer: true, road: true, pollute: 2, pr: 2, cat: 'waste' },
  32: { id: 32, key: 'rcomplex', name: 'Recycling complex', w: 3, d: 3, cost: 14000, upkeep: 380, waste: 1200, radius: 22, pollute: 4, pr: 5, use: 20, cat: 'waste' },
  // 0.9.0: batteries store daytime sun and wind for the night (must touch a power line); the sewage works cleans what the
  // pipes carry away and sends part of it back as clean water (must touch a pipe, needs power)
  33: { id: 33, key: 'battery', name: 'Battery storage', w: 1, d: 1, cost: 2500, upkeep: 20, store: 80, cat: 'util' },
  34: { id: 34, key: 'sewage', name: 'Sewage works', w: 2, d: 2, cost: 4500, upkeep: 110, sewer: 700, use: 6, pollute: 4, pr: 4, cat: 'util' },
  18: { id: 18, key: 'wte', name: 'Waste-to-energy', w: 2, d: 2, cost: 5200, upkeep: 140, waste: 200, radius: 14, power: 40, pollute: 8, pr: 6, cat: 'waste' },
};
// Shore buildings face the water on one side: face 0 = +x, 1 = +y, 2 = -x, 3 = -y (stored in world.variant).
// Local coordinates: u = distance out from the water edge of the footprint (negative = on land), v = along the shore (0..size).
export const FACE_OUT = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export function shoreXY(face, s, u, v) { return face === 0 ? [s + u, v] : face === 1 ? [v, s + u] : face === 2 ? [-u, v] : [v, -u]; }
// The water tiles in front of a shore building at anchor (x, y): rows 0..reach-1 (under the structure), then the berth row if it has one.
export function frontTiles(def, x, y, face, berth) {
  const out = [], s = def.w, rows = def.reach + (berth && def.dock ? 1 : 0);
  for (let r = 0; r < rows; r++) for (let c = 0; c < s; c++) { const [X, Y] = shoreXY(face, s, r + 0.5, c + 0.5); out.push([x + Math.floor(X), y + Math.floor(Y), r]); }
  return out;
}
// Where boats tie up: the middle of the berth row.
export function berthTile(def, x, y, face) { const [X, Y] = shoreXY(face, def.w, def.reach + 0.5, Math.max(0.5, def.w / 2 - 0.5)); return [x + Math.floor(X), y + Math.floor(Y)]; }
export const BY_KEY = Object.fromEntries(Object.values(BT).map((b) => [b.key, b]));
// per zone level 0..4 (level 4 = skyscrapers, office megatowers and hi-tech campuses)
export const ELEC = { r: [0, 2, 6, 16, 34], c: [0, 2, 6, 18, 40], i: [0, 4, 10, 24, 30] };
export const WATER = { r: [0, 2, 6, 16, 34], c: [0, 1, 4, 12, 26], i: [0, 3, 8, 20, 22] };
export const WASTE = { r: [0, 1, 3, 9, 18], c: [0, 2, 5, 14, 26], i: [0, 3, 8, 20, 16] };
// which services shut down first when the city owes the bank money (stage 1, 2, 3)
export const CUT_STAGE = { fun: 1, edu: 2, transit: 2, safety: 3 };
export function cutGroup(def) {
  if (!def) return null;
  if (def.cat === 'fun') return 'fun';
  if (def.cat === 'transit') return 'transit';
  if (def.key === 'school' || def.key === 'university') return 'edu';
  if (def.cat === 'svc') return 'safety';            // police, fire, clinics and hospitals
  return null;                                       // power, water and garbage always keep running
}
