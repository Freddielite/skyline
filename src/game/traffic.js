// Traffic signals and car-following shared by every kind of vehicle.
export const CYCLE = 14;                                  // seconds per signal cycle

export function arms(w, x, y) { const m = w.roadMask(x, y); return (m & 1 ? 1 : 0) + (m & 2 ? 1 : 0) + (m & 4 ? 1 : 0) + (m & 8 ? 1 : 0); }
export function isSignal(w, x, y) { return w.isRoad(x, y) && arms(w, x, y) >= 3; }

// 'g' green, 'y' yellow, 'r' red for traffic moving along the y axis (vertical) or x axis
export function light(t, x, y, vertical) {
  const o = ((x * 7 + y * 13) % 5) * 0.9, p = (((t + o) % CYCLE) + CYCLE) % CYCLE;
  if (p < 5.5) return vertical ? 'g' : 'r';
  if (p < 6.5) return vertical ? 'y' : 'r';
  if (p < 7) return 'r';
  if (p < 12.5) return vertical ? 'r' : 'g';
  if (p < 13.5) return vertical ? 'r' : 'y';
  return 'r';
}
export const mustStop = (w, x, y, dx, dy, t) => isSignal(w, x, y) && light(t, x, y, dy !== 0) !== 'g';

// A vehicle waits when another one is just ahead of it in the same lane. Vehicles are sorted into their road tiles
// first, so each one only looks at the few on its own tile and the next one (instead of every vehicle on the map).
import { N } from './world.js';
const head = new Int32Array(N * N).fill(-1);
let nxt = new Int32Array(1024), tileOf = new Int32Array(1024);
export function followPass(list) {
  const n = list.length;
  if (nxt.length < n) { nxt = new Int32Array(n * 2); tileOf = new Int32Array(n * 2); }
  for (let i = 0; i < n; i++) {
    const v = list[i]; v.hold = false;
    const tx = Math.max(0, Math.min(N - 1, Math.floor(v.px))), ty = Math.max(0, Math.min(N - 1, Math.floor(v.py))), t = ty * N + tx;
    tileOf[i] = t; nxt[i] = head[t]; head[t] = i;
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
