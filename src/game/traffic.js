// Junctions, traffic signals and car-following shared by every kind of vehicle.
//
// Junction control (0.6.2, Traffic part 2). Every junction (a road tile with three or four arms) is one of:
//   PRI_V / PRI_H  priority junction: traffic on the major road (vertical = along y, horizontal = along x) drives on;
//                  vehicles on the side roads give way while something is crossing on the major road.
//   SIGNAL         traffic lights, only where two busy roads meet. The green time is shared by the traffic each way.
// Flow.finish() decides the type of each junction from the real trips (flow.js) and stores it on the world as
// w.jn (type per tile) and w.jsplit (share of the green time for the vertical road). Until the first traffic pass,
// or for a junction built since, defaultJunction() gives a sensible type from the road layout alone.
import { N } from './world.js';

export const CYCLE = 14;                                  // seconds per signal cycle
export const PRI_V = 1, PRI_H = 2, SIGNAL = 3;
const AMBER = 1, ALLRED = 0.5, GREEN = CYCLE - 2 * (AMBER + ALLRED);   // 11 s of green to share out
const MAX_WAIT = 3.5;                                     // a side-road driver gives up waiting for a gap after this long

export function arms(w, x, y) { const m = w.roadMask(x, y); return (m & 1 ? 1 : 0) + (m & 2 ? 1 : 0) + (m & 4 ? 1 : 0) + (m & 8 ? 1 : 0); }

// The type from the layout alone: the straight-through road of a T is the major road; at a crossroads the wider road
// (highway, then avenue) wins, and the vertical road if they are alike.
export function defaultJunction(w, x, y) {
  const m = w.roadMask(x, y), v = (m & 1 ? 1 : 0) + (m & 4 ? 1 : 0), h = (m & 2 ? 1 : 0) + (m & 8 ? 1 : 0);
  if (v + h < 3) return 0;
  if (v + h === 3) return v === 2 ? PRI_V : PRI_H;
  const rank = (xx, yy) => { if (!w.inb(xx, yy)) return 2; const q = w.idx(xx, yy); return w.hw[q] ? 2 : w.level[q] === 1 ? 1 : 0; };
  const rv = rank(x, y - 1) + rank(x, y + 1), rh = rank(x - 1, y) + rank(x + 1, y);
  return rh > rv ? PRI_H : PRI_V;
}
export function junctionType(w, x, y) {
  if (!w.isRoad(x, y)) return 0;
  const i = y * N + x, fx = w.jfix && w.jfix[i], t = fx || (w.jn ? w.jn[i] : 0);
  if (t) return arms(w, x, y) >= 3 ? t : 0;               // stale entry after a road was removed
  return defaultJunction(w, x, y);
}
export function isSignal(w, x, y) { return junctionType(w, x, y) === SIGNAL; }
export function greenShare(w, x, y) { return w.jsplit ? w.jsplit[y * N + x] || 0.5 : 0.5; }

// 'g' green, 'y' yellow, 'r' red for traffic moving along the y axis (vertical) or x axis. `share` is the vertical
// road's part of the green time (0.5 = equal); the busier road gets the longer green.
export function light(t, x, y, vertical, share = 0.5) {
  const gv = Math.max(3.5, Math.min(GREEN - 3.5, GREEN * share)), gh = GREEN - gv;
  const o = ((x * 7 + y * 13) % 5) * 0.9, p = (((t + o) % CYCLE) + CYCLE) % CYCLE;
  const a = gv, b = a + AMBER, c = b + ALLRED, d = c + gh, e = d + AMBER;
  if (p < a) return vertical ? 'g' : 'r';
  if (p < b) return vertical ? 'y' : 'r';
  if (p < c) return 'r';
  if (p < d) return vertical ? 'r' : 'g';
  if (p < e) return vertical ? 'r' : 'y';
  return 'r';
}

// Vehicles moving on each tile, by direction (0 up, 1 right, 2 down, 3 left), filled by followPass every frame.
// Side-road drivers look at it to find a gap in the traffic on the major road.
const occ = new Uint8Array(N * N * 4), occT = [];
const dirOf = (dx, dy) => (dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3);
const busy = (x, y, d) => x >= 0 && y >= 0 && x < N && y < N && occ[(y * N + x) * 4 + d] > 0;

// Must a vehicle heading into tile (x, y) along (dx, dy) wait at the line? `v` (optional) is the vehicle, used to
// remember how long it has waited for a gap so a side road never stays blocked for good.
export function mustStop(w, x, y, dx, dy, t, v) {
  const type = junctionType(w, x, y); if (!type) return false;
  const vertical = dy !== 0;
  if (type === SIGNAL) return light(t, x, y, vertical, greenShare(w, x, y)) !== 'g';
  if ((type === PRI_V) === vertical) return false;        // on the major road: drive on
  // a side road: wait while the major road is in use at the junction or just before it
  const conflict = type === PRI_V
    ? busy(x, y, 0) || busy(x, y, 2) || busy(x, y + 1, 0) || busy(x, y - 1, 2)
    : busy(x, y, 1) || busy(x, y, 3) || busy(x - 1, y, 1) || busy(x + 1, y, 3);
  if (!conflict) { if (v) v.gw = 0; return false; }
  if (!v) return true;
  const key = y * N + x;
  if (!v.gw || v.gwAt !== key) { v.gw = t || 0.001; v.gwAt = key; }
  if (t - v.gw > MAX_WAIT) { v.gw = 0; return false; }   // waited long enough: edge out
  return true;
}

// A vehicle waits when another one is just ahead of it in the same lane. Vehicles are sorted into their road tiles
// first, so each one only looks at the few on its own tile and the next one (instead of every vehicle on the map).
const head = new Int32Array(N * N).fill(-1);
let nxt = new Int32Array(1024), tileOf = new Int32Array(1024);
export function followPass(list) {
  const n = list.length;
  if (nxt.length < n) { nxt = new Int32Array(n * 2); tileOf = new Int32Array(n * 2); }
  for (const q of occT) occ[q] = 0; occT.length = 0;
  for (let i = 0; i < n; i++) {
    const v = list[i]; v.hold = false;
    const tx = Math.max(0, Math.min(N - 1, Math.floor(v.px))), ty = Math.max(0, Math.min(N - 1, Math.floor(v.py))), t = ty * N + tx;
    tileOf[i] = t; nxt[i] = head[t]; head[t] = i;
    if (!v.ped && (v.dx || v.dy)) { const q = t * 4 + dirOf(v.dx, v.dy); if (!occ[q]) occT.push(q); if (occ[q] < 255) occ[q]++; }
  }
  for (let i = 0; i < n; i++) {
    const v = list[i], t = tileOf[i];
    for (let pass = 0; pass < 2 && !v.hold; pass++) {
      let tt = t;
      if (pass) { const x = (t % N) + (v.dx | 0), y = ((t / N) | 0) + (v.dy | 0); if (x < 0 || y < 0 || x >= N || y >= N) break; tt = y * N + x; }
      for (let j = head[tt]; j >= 0; j = nxt[j]) {
        if (j === i) continue;
        const u = list[j];
        if (u.dx !== v.dx || u.dy !== v.dy) continue;
        const rx = u.px - v.px, ry = u.py - v.py, ahead = rx * v.dx + ry * v.dy;
        if (ahead <= 0 || ahead > (u.bus || v.bus ? 0.5 : 0.34)) continue;
        if (Math.abs(rx * v.dy) + Math.abs(ry * v.dx) > 0.12) continue;
        v.hold = true; break;
      }
    }
  }
  for (let i = 0; i < n; i++) head[tileOf[i]] = -1;
}
