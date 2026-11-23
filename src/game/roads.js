// Road wear and repairs (0.9.0). Every street wears with the traffic on it (avenues a little slower; the highway is the
// region's). A worn road is slower and looks it: cracks, then potholes. Road crews (City → Services → Road repairs budget)
// fix the worst roads: a small repair closes one lane for a few days, a big one (a road left to fall apart) closes it, so
// drivers go round. "Repair now" in a road's Inspector fixes it at once, for more money.
import { N, T, TERRAIN } from './world.js';

export const WORN = 60, REPAIR_AT = 72, BIG_AT = 92;    // cracks from 60; crews come from 72; past 92 the road has to close
export const LANE_COST = 25, BIG_COST = 90;              // $ per tile
const LANE_DAYS = 5, BIG_DAYS = 9;               // game days (a game day passes in about a second at normal speed)

// how much slower a road is for its wear and any repair (flow.js travel time and capacity)
export function wearMul(w, i) {
  const wr = w.wear ? w.wear[i] : 0, fx = w.fix ? w.fix[i] : 0;
  if (fx === 2) return 30;                               // closed: routes go round it
  return (1 + Math.max(0, wr - WORN) / 70) * (fx === 1 ? 1.6 : 1);
}
export function capMul(w, i) { const fx = w.fix ? w.fix[i] : 0; return fx === 2 ? 0.05 : fx === 1 ? 0.5 : 1; }
export const roadWorn = (w, i) => (w.wear ? w.wear[i] : 0);

// One game day of wear and repair work. `sim.repairs`: tile → { big, left } (saved).
export function roadDay(sim) {
  const w = sim.w, n = N * N, load = sim.flowM.load;
  if (!w.wear) w.wear = new Uint8Array(n);
  if (!w.fix) w.fix = new Uint8Array(n);
  const acc = sim.wearAcc || (sim.wearAcc = new Float32Array(n));
  let changed = false;
  // repairs under way
  for (const [i, r] of sim.repairs) {
    if (w.kind[i] !== T.ROAD) { sim.repairs.delete(i); w.fix[i] = 0; changed = true; continue; }
    if (--r.left <= 0) { sim.repairs.delete(i); w.fix[i] = 0; w.wear[i] = 0; acc[i] = 0; changed = true; }
  }
  // wear: a little from weather and age, more from traffic (a street at capacity needs work after about half a year)
  let worn = 0, roads = 0, worst = -1, wv = -1;
  for (let i = 0; i < n; i++) {
    if (w.kind[i] !== T.ROAD) { if (w.wear[i]) { w.wear[i] = 0; acc[i] = 0; w.fix[i] = 0; } continue; }
    if (w.hw[i]) continue;
    roads++;
    if (!w.fix[i]) {
      const L = Math.min(2, load[i] || 0), av = w.level[i] === 1, br = w.terrain[i] === TERRAIN.WATER;
      acc[i] += (0.035 + 0.38 * Math.pow(L, 1.3)) * (av ? 0.7 : 1) * (br ? 0.6 : 1);
      if (acc[i] >= 1) { const k = Math.floor(acc[i]); acc[i] -= k; w.wear[i] = Math.min(100, w.wear[i] + k); }
    }
    if (w.wear[i] >= REPAIR_AT) { worn++; if (!w.fix[i] && w.wear[i] > wv) { wv = w.wear[i]; worst = i; } }
  }
  // crews: one per 90 road tiles (at least one), scaled by the road budget
  const crews = Math.max(1, Math.round((1 + roads / 90) * ((sim.fund.roads ?? 100) / 100)));
  for (let k = 0; k < 3 && sim.repairs.size < crews; k++) {
    let best = -1, bv = REPAIR_AT - 1;
    for (let i = 0; i < n; i++) if (w.kind[i] === T.ROAD && !w.hw[i] && !w.fix[i] && w.wear[i] > bv) { bv = w.wear[i]; best = i; }
    if (best < 0) break;
    const big = w.wear[best] >= BIG_AT;
    sim.repairs.set(best, { big, left: big ? BIG_DAYS : LANE_DAYS }); w.fix[best] = big ? 2 : 1;
    sim.roadSpend = (sim.roadSpend || 0) + (big ? BIG_COST : LANE_COST); changed = true;
  }
  sim.roadStats = { worn, roads, crews, worst, busy: sim.repairs.size };
  if (changed) { sim.flowM.dirty = true; sim.roadsDirty = true; w.wearVer = (w.wearVer || 0) + 1; }
  // the visible wear moves in steps: tell the still view now and then
  if ((sim.day % 5) === 0) w.wearVer = (w.wearVer || 0) + 1;
}

export function repairNowCost(w, i) { return Math.round(30 + (w.wear ? w.wear[i] : 0) * 1.5); }
export function repairNow(sim, i) {
  const w = sim.w; if (w.kind[i] !== T.ROAD || w.hw[i]) return { ok: false };
  const c = repairNowCost(w, i); if (!sim.spend(c)) return { ok: false, why: sim.noMoney() };
  w.wear[i] = 0; if (sim.wearAcc) sim.wearAcc[i] = 0; w.fix[i] = 0; sim.repairs.delete(i);
  sim.flowM.dirty = true; sim.roadsDirty = true; w.wearVer = (w.wearVer || 0) + 1;
  return { ok: true, cost: c };
}
