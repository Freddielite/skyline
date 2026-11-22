// Moving vans: when homes empty out, the residents load up and drive off along the roads to the highway
// and out of the map. When new homes fill up, vans come in from the highway to them.
import { N } from './world.js';
import { mustStop } from './traffic.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const MAX_ACTIVE = 22;          // vans on the map at once
const MAX_QUEUE = 40;           // waiting to set off; older requests are dropped beyond this
const PER_VAN = 8;              // residents per van

export class Movers {
  constructor(world, rnd) { this.w = world; this.rnd = rnd; this.list = []; this.queue = []; this.timer = 0; this.stats = { out: 0, in: 0 }; }
  get vans() { return this.list; }
  leave(i, n) { this.request(i, n, true); }
  arrive(i, n) { this.request(i, n, false); }
  request(i, n, out) {
    const k = Math.max(1, Math.min(3, Math.round(n / PER_VAN)));
    for (let j = 0; j < k; j++) this.queue.push({ i, out, delay: j * (0.8 + this.rnd()) });
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
  }
  // The road tile a home uses: the closest road within 2 tiles.
  access(i) {
    const w = this.w, x0 = i % N, y0 = (i / N) | 0; let best = -1, bd = 1e9;
    for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++) {
      if (!w.isRoad(x, y)) continue;
      const d = Math.abs(x - x0) + Math.abs(y - y0); if (d < bd) { bd = d; best = y * N + x; }
    }
    return best;
  }
  // Shortest road path from a tile to any highway exit at the map edge, ending with the step off the map.
  toExit(s) {
    const w = this.w, prev = new Int32Array(N * N).fill(-2), q = [s]; prev[s] = -1; let hit = -1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % N, y = (c / N) | 0;
      if (w.edgeOpen(x, y)) { hit = c; break; }
      for (const [dx, dy] of DIRS) { const xx = x + dx, yy = y + dy; if (!w.isRoad(xx, yy)) continue; const n = yy * N + xx; if (prev[n] === -2) { prev[n] = c; q.push(n); } }
    }
    if (hit < 0) return null;
    const path = []; for (let c = hit; c !== -1; c = prev[c]) path.push(c); path.reverse();
    const ex = hit % N, ey = (hit / N) | 0, out = ex === 0 ? [-1, 0] : ex === N - 1 ? [1, 0] : ey === 0 ? [0, -1] : [0, 1];
    return { tiles: path.map((c) => [c % N, (c / N) | 0]), off: [ex + out[0], ey + out[1]] };
  }
  spawn(job) {
    const w = this.w, s = this.access(job.i); if (s < 0) return null;
    const r = this.toExit(s); if (!r) return null;                       // not linked to the highway: nobody drives anywhere
    const pts = job.out ? [...r.tiles, r.off] : [r.off, ...r.tiles.slice().reverse()];
    if (pts.length < 2) return null;
    const v = { van: true, pts, k: 0, t: job.out ? 0.5 : 0, speed: 0.85 + this.rnd() * 0.3, col: Math.floor(this.rnd() * 8), off: 0.13, out: job.out, px: 0, py: 0, dx: 0, dy: 0, alpha: 1 };
    this.place(v);
    return v;
  }
  // Position inside the current tile: arriving along the old direction, leaving along the new one, so turns are smooth.
  place(v) {
    const P = v.pts, a = P[v.k], b = P[Math.min(P.length - 1, v.k + 1)], p = P[Math.max(0, v.k - 1)];
    const ox = Math.sign(b[0] - a[0]), oy = Math.sign(b[1] - a[1]);
    const ix = v.k > 0 ? Math.sign(a[0] - p[0]) : ox, iy = v.k > 0 ? Math.sign(a[1] - p[1]) : oy;
    const [dx, dy] = v.t < 0.5 ? [ix, iy] : [ox, oy];
    v.dx = dx; v.dy = dy;
    v.px = a[0] + 0.5 + dx * (v.t - 0.5) - dy * v.off;
    v.py = a[1] + 0.5 + dy * (v.t - 0.5) + dx * v.off;
    const last = v.pts.length - 1;                                   // fade in or out over the tile beyond the map edge
    v.alpha = v.out ? (v.k === last - 1 && v.t > 0.5 ? Math.max(0, 1 - (v.t - 0.5) * 2) : 1) : (v.k === 0 ? Math.min(1, v.t * 2) : 1);
  }
  update(dt, sigT) {
    if (dt <= 0) return;
    this.timer += dt;
    for (const j of this.queue) j.delay -= dt;
    if (this.timer > 0.5 && this.list.length < MAX_ACTIVE) {
      const n = this.queue.findIndex((j) => j.delay <= 0);
      if (n >= 0) { this.timer = 0; const job = this.queue.splice(n, 1)[0]; const v = this.spawn(job); if (v) { this.list.push(v); this.stats[job.out ? 'out' : 'in']++; } }
    }
    const w = this.w;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i], last = v.pts.length - 1;
      let nt = v.t + (v.hold ? 0 : dt * v.speed);
      const nx = v.pts[Math.min(last, v.k + 1)];
      if (nt > 0.8 && v.t <= 0.8 && v.k + 1 <= last && w.inb(nx[0], nx[1]) && mustStop(w, nx[0], nx[1], v.dx, v.dy, sigT)) nt = 0.8;   // wait at red lights
      v.t = nt;
      let gone = false;
      while (v.t >= 1) {
        v.t -= 1; v.k++;
        if (v.k >= last) { gone = true; break; }                        // drove off the map, or reached the new home's street
        const [x, y] = v.pts[v.k];
        if (w.inb(x, y) && !w.isRoad(x, y)) { gone = true; break; }    // the road was bulldozed under it
      }
      if (gone) { this.list.splice(i, 1); continue; }
      this.place(v);
    }
  }
}
