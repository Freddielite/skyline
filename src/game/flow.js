// Traffic from real trips (0.6.1).
// The map is split into districts of 6x6 tiles. Each district sends its workers to jobs, its residents to shops and its
// industry's lorries to the highway, along the quickest routes. Every road tile gets a load (traffic / capacity); the
// quickest route takes the last loads into account, so new roads, avenues and transit really pull traffic away.
// The work is spread over frames (one district at a time, a couple of milliseconds per frame) and a full pass takes a
// few seconds; the result is blended into the previous one so routes settle instead of flipping back and forth.
import { N, T, TERRAIN } from './world.js';

const DS = 6, DN = Math.ceil(N / DS);
const CAP = { street: 55, avenue: 120, highway: 170 };     // trips a road tile carries before it starts to slow down
const POP_CAP = [0, 8, 24, 70, 160], COM_CAP = [0, 5, 14, 40, 95], IND_CAP = [0, 8, 18, 42, 70];
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const PEAK = 0.08;                                        // the share of daily trips on the road in the busiest hour

export class Flow {
  constructor(world) {
    const n = N * N;
    this.w = world;
    this.flow = new Float32Array(n);      // trips per road tile (blended over passes)
    this.next = new Float32Array(n);      // the pass being built
    this.load = new Float32Array(n);      // flow / capacity
    this.cost = new Float32Array(n).fill(1);   // travel time through a road tile, used for routes
    this.dist = new Float32Array(n); this.prev = new Int32Array(n); this.acc = new Float32Array(n);
    this.order = new Int32Array(n); this.hd = new Float32Array(n * 4 + 8); this.hi = new Int32Array(n * 4 + 8);
    this.job = null; this.dirty = true; this.passes = 0; this.lastDay = -99; this.version = 0;
    this.pickTiles = new Int32Array(0); this.pickCum = new Float32Array(0); this.total = 0;
  }
  capOf(i) { const w = this.w; return w.hw[i] ? CAP.highway : w.level[i] === 1 && w.terrain[i] !== TERRAIN.WATER ? CAP.avenue : CAP.street; }
  baseOf(i) { const w = this.w; return w.hw[i] ? 0.6 : w.level[i] === 1 && w.terrain[i] !== TERRAIN.WATER ? 0.7 : 1; }
  // Called every frame; does at most `ms` milliseconds of work.
  step(sim, ms) {
    if (!this.job) { if (!this.dirty && sim.day - this.lastDay < 6) return; this.begin(sim); if (!this.job) return; }
    const t0 = performance.now(), job = this.job;
    while (job.k < job.origins.length && performance.now() - t0 < ms) this.origin(job, job.origins[job.k++]);
    if (job.k >= job.origins.length) this.finish(sim);
  }
  // Gather the districts: where homes, jobs, shops and industry are, and one road tile to stand for each.
  begin(sim) {
    const w = this.w, n = DN * DN, H = new Float32Array(n), J = new Float32Array(n), S = new Float32Array(n), F = new Float32Array(n), tr = new Float32Array(n), sx = new Float32Array(n), sy = new Float32Array(n), sw = new Float32Array(n);
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i]; if (k !== T.RES && k !== T.COM && k !== T.IND) continue;
      const l = sim.lvl(i); if (!l) continue;
      const x = i % N, y = (i / N) | 0, d = ((y / DS) | 0) * DN + ((x / DS) | 0);
      let wt = 0;
      if (k === T.RES) { const p = POP_CAP[l] * 0.5 * PEAK; H[d] += p; tr[d] += p * Math.min(0.7, 0.4 * sim.cov.transit[i] + 0.55 * (sim.cov.metro ? sim.cov.metro[i] : 0)); wt = p; }
      else if (k === T.COM) { J[d] += COM_CAP[l]; S[d] += COM_CAP[l]; wt = COM_CAP[l]; }
      else { const j = IND_CAP[l]; J[d] += j; F[d] += j * 0.25 * PEAK; wt = j; }
      sx[d] += x * wt; sy[d] += y * wt; sw[d] += wt;
    }
    const rep = new Int32Array(n).fill(-1), origins = [];
    for (let d = 0; d < n; d++) {
      if (!sw[d]) continue;
      const cx = sx[d] / sw[d], cy = sy[d] / sw[d]; let best = -1, bd = 1e9;
      for (let y = Math.max(0, Math.floor(cy) - DS); y <= Math.min(N - 1, Math.floor(cy) + DS); y++) for (let x = Math.max(0, Math.floor(cx) - DS); x <= Math.min(N - 1, Math.floor(cx) + DS); x++) {
        const q = y * N + x; if (w.kind[q] !== T.ROAD) continue; const dd = Math.abs(x - cx) + Math.abs(y - cy); if (dd < bd) { bd = dd; best = q; }
      }
      rep[d] = best; if (best >= 0 && (H[d] > 0 || F[d] > 0)) origins.push(d);
    }
    let hwEnds = []; for (let i = 0; i < N * N; i++) if (w.hw[i] && w.kind[i] === T.ROAD) { const x = i % N, y = (i / N) | 0; if (x === 0 || y === 0 || x === N - 1 || y === N - 1) hwEnds.push(i); }
    if (!hwEnds.length) hwEnds = [];
    this.next.fill(0);
    this.job = { H, J, S, F, tr, rep, origins, k: 0, hwEnds };
    this.dirty = false; this.lastDay = sim.day;
  }
  // One district: quickest routes to everywhere, share its trips out by attraction and distance, then push them back
  // along the route tree onto the road tiles (one sweep in reverse order of distance, no per-trip path tracing).
  origin(job, o) {
    const w = this.w, s0 = job.rep[o], dist = this.dist, prev = this.prev, order = this.order, cost = this.cost, hd = this.hd, hi = this.hi, acc = this.acc;
    let len = 0, settled = 0;
    const push = (d, i) => { let k = len++; while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= d) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; } hd[k] = d; hi[k] = i; };
    const mark = this.mark || (this.mark = new Int32Array(N * N)), done = this.done || (this.done = new Int32Array(N * N)), gen = (this.gen = (this.gen | 0) + 1);
    dist[s0] = 0; prev[s0] = -1; mark[s0] = gen; push(0, s0);
    while (len) {
      const d = hd[0], c = hi[0]; len--;
      if (len) { const ld = hd[len], li = hi[len]; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; if (l >= len) break; const m = r < len && hd[r] < hd[l] ? r : l; if (hd[m] >= ld) break; hd[k] = hd[m]; hi[k] = hi[m]; k = m; } hd[k] = ld; hi[k] = li; }
      if (done[c] === gen || d > dist[c] || d > 80) continue;
      done[c] = gen; order[settled++] = c; acc[c] = 0;
      const x = c % N, y = (c / N) | 0;
      for (let j = 0; j < 4; j++) {
        const xx = x + D4[j][0], yy = y + D4[j][1]; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const q = yy * N + xx; if (w.kind[q] !== T.ROAD) continue;
        const nd = d + cost[q]; if (mark[q] !== gen || nd < dist[q]) { mark[q] = gen; dist[q] = nd; prev[q] = c; push(nd, q); }
      }
    }
    // share trips by attraction and distance (commutes reach further than shopping)
    const H = job.H[o] - job.tr[o], add = (wts, total) => {
      let sum = 0; for (const [q, a] of wts) sum += a; if (sum <= 0) return;
      for (const [q, a] of wts) acc[q] += total * a / sum;
    };
    if (H > 0) {
      const jw = [], sw = [];
      for (let d = 0; d < job.rep.length; d++) { const q = job.rep[d]; if (q < 0 || done[q] !== gen) continue; const dd = dist[q]; if (job.J[d]) jw.push([q, job.J[d] * Math.exp(-dd / 28)]); if (job.S[d]) sw.push([q, job.S[d] * Math.exp(-dd / 14)]); }
      add(jw, H); add(sw, H * 0.35);
    }
    if (job.F[o] > 0) { let best = -1, bd = 1e9; for (const q of job.hwEnds) if (done[q] === gen && dist[q] < bd) { bd = dist[q]; best = q; } if (best >= 0) acc[best] += job.F[o]; }
    // push the trips back toward the origin along the route tree
    const next = this.next;
    for (let k = settled - 1; k > 0; k--) { const c = order[k], a = acc[c]; if (a <= 0) continue; next[c] += a; const p = prev[c]; if (p >= 0) acc[p] += a; }
    if (settled) next[s0] += acc[s0];
  }
  finish(sim) {
    const w = this.w, f = this.flow, nx = this.next, first = this.passes === 0; let total = 0, cnt = 0;
    for (let i = 0; i < N * N; i++) {
      if (w.kind[i] !== T.ROAD) { f[i] = 0; this.load[i] = 0; this.cost[i] = 1; continue; }
      f[i] = first ? nx[i] : f[i] * 0.5 + nx[i] * 0.5;
      const L = f[i] / this.capOf(i); this.load[i] = L;
      this.cost[i] = this.baseOf(i) * Math.min(5, 1 + 0.5 * Math.pow(L, 4));     // busy roads get slow fast once past capacity
      total += f[i]; if (f[i] > 0.5) cnt++;
    }
    // a sampler so the cars on screen appear where the trips are
    const tiles = new Int32Array(cnt), cum = new Float32Array(cnt); let c = 0, run = 0;
    for (let i = 0; i < N * N; i++) if (w.kind[i] === T.ROAD && f[i] > 0.5) { run += f[i]; tiles[c] = i; cum[c++] = run; }
    this.pickTiles = tiles; this.pickCum = cum; this.total = run;
    this.job = null; this.passes++; this.version++;
    if (this.passes < 3) this.dirty = true;     // the first few passes follow each other quickly so routes settle
  }
  pick(r) {                                   // a road tile, chosen in proportion to its traffic (r in 0..1)
    const cum = this.pickCum; if (!cum.length) return -1;
    const v = r * this.total; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < v) lo = m + 1; else hi = m; }
    return this.pickTiles[lo];
  }
}
