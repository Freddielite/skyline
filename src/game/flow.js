// Traffic from real trips (0.6.1).
// The map is split into districts of 6x6 tiles. Each district sends its workers to jobs, its residents to shops and its
// industry's lorries to the highway, along the quickest routes. Every road tile gets a load (traffic / capacity); the
// quickest route takes the last loads into account, so new roads, avenues and transit really pull traffic away.
// The work is spread over frames (one district at a time, a couple of milliseconds per frame) and a full pass takes a
// few seconds; the result is blended into the previous one so routes settle instead of flipping back and forth.
import { N, T, TERRAIN } from './world.js';
import { PRI_V, PRI_H, SIGNAL, defaultJunction } from './traffic.js';

const DS = 6, DN = Math.ceil(N / DS);
const CAP = { street: 55, avenue: 120, highway: 170 };     // trips a road tile carries before it starts to slow down
const POP_CAP = [0, 8, 24, 70, 160], COM_CAP = [0, 5, 14, 40, 95], IND_CAP = [0, 8, 18, 42, 70];
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const distOf = (i) => (((i / N) | 0) / DS | 0) * DN + (((i % N) / DS) | 0);     // the district a tile is in
export const DISTRICT = DS, DISTRICTS = DN;
let WORKER = null, OWNER = null, NO_WORKER = false, SEQ = 0;   // the shared traffic worker (useWorker)
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
    if (this.pq) { this.probeStep(ms); return; }           // a road's trips being traced for the Inspector come first
    if (this.useWorker(sim)) return;                        // the pass runs in a Web Worker (flowworker.js)
    if (!this.job) { if (!this.dirty && sim.day - this.lastDay < 6) return; this.begin(sim); if (!this.job) return; }
    const t0 = performance.now(), job = this.job;
    while (job.k < job.origins.length && performance.now() - t0 < ms) this.origin(job, job.origins[job.k++]);
    if (job.k >= job.origins.length) this.finish(sim);
  }
  // Off the main thread: send a snapshot when a pass is due, finish it here when the answer comes back. Falls back to the
  // frame-by-frame pass if workers aren't available or one fails.
  useWorker(sim) {
    if (this.noWorker || NO_WORKER || typeof Worker === 'undefined') return false;
    if (!WORKER) {                                           // one worker for the app; a new city's Flow takes it over
      try { WORKER = new Worker(new URL('./flowworker.js', import.meta.url), { type: 'module' }); }
      catch (e) { NO_WORKER = true; return false; }
      WORKER.onmessage = (e) => {
        const f = OWNER, m = e.data; if (!f) return; f.wBusy = false; if (m.id !== f.wId || !m.job) return;
        f.next = m.next; f.job = m.job; f.job.k = m.job.origins.length; f.finish(f.wSim);
      };
      WORKER.onerror = () => { NO_WORKER = true; if (OWNER) OWNER.wBusy = false; try { WORKER.terminate(); } catch (e) { /* ignore */ } };
    }
    if (OWNER !== this) { if (OWNER) OWNER.wBusy = false; OWNER = this; this.wBusy = false; }
    if (this.wBusy) { if (performance.now() - this.wAt > 15000) { this.noWorker = true; this.wBusy = false; } return true; }   // stuck: go back to the main thread
    if (!this.dirty && sim.day - this.lastDay < 6) return true;
    const w = this.w, n = N * N, lvl = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const k = w.kind[i]; if (k === T.RES || k === T.COM || k === T.IND) lvl[i] = sim.lvl(i); }
    this.wId = (SEQ = SEQ + 1); this.wBusy = true; this.wAt = performance.now(); this.wSim = sim;
    this.dirty = false; this.lastDay = sim.day;
    WORKER.postMessage({ id: this.wId, kind: w.kind.slice(), level: w.level.slice(), hw: w.hw.slice(), terrain: w.terrain.slice(), cost: this.cost.slice(), lvl,
      transit: sim.cov.transit.slice(), metro: sim.cov.metro ? sim.cov.metro.slice() : new Float32Array(n), day: sim.day });
    return true;
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
    const s0 = job.rep[o], dist = this.dist, prev = this.prev, order = this.order, acc = this.acc;
    const settled = this.tree(s0), gen = this.gen, done = this.done;
    for (let k = 0; k < settled; k++) acc[order[k]] = 0;
    this.share(job, o, (q, a) => { acc[q] += a; });
    // push the trips back toward the origin along the route tree
    const next = this.next;
    for (let k = settled - 1; k > 0; k--) { const c = order[k], a = acc[c]; if (a <= 0) continue; next[c] += a; const p = prev[c]; if (p >= 0) acc[p] += a; }
    if (settled) next[s0] += acc[s0];
  }
  // Quickest routes from one road tile to everywhere (Dijkstra over travel times). Fills dist, prev and order (tiles in
  // order of distance) and returns how many tiles were reached; done[i] === this.gen marks them.
  tree(s0) {
    const w = this.w, dist = this.dist, prev = this.prev, order = this.order, cost = this.cost, hd = this.hd, hi = this.hi;
    let len = 0, settled = 0;
    const push = (d, i) => { let k = len++; while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= d) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; } hd[k] = d; hi[k] = i; };
    const mark = this.mark || (this.mark = new Int32Array(N * N)), done = this.done || (this.done = new Int32Array(N * N)), gen = (this.gen = (this.gen | 0) + 1);
    dist[s0] = 0; prev[s0] = -1; mark[s0] = gen; push(0, s0);
    while (len) {
      const d = hd[0], c = hi[0]; len--;
      if (len) { const ld = hd[len], li = hi[len]; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; if (l >= len) break; const m = r < len && hd[r] < hd[l] ? r : l; if (hd[m] >= ld) break; hd[k] = hd[m]; hi[k] = hi[m]; k = m; } hd[k] = ld; hi[k] = li; }
      if (done[c] === gen || d > dist[c] || d > 200) continue;     // far enough for any commute, even through jams (was 80: jammed routes lost their trips)
      done[c] = gen; order[settled++] = c;
      const x = c % N, y = (c / N) | 0;
      for (let j = 0; j < 4; j++) {
        const xx = x + D4[j][0], yy = y + D4[j][1]; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const q = yy * N + xx; if (w.kind[q] !== T.ROAD) continue;
        const nd = d + cost[q]; if (mark[q] !== gen || nd < dist[q]) { mark[q] = gen; dist[q] = nd; prev[q] = c; push(nd, q); }
      }
    }
    return settled;
  }
  // Share one district's trips out by attraction and distance (commutes reach further than shopping). Calls
  // put(destination road tile, trips, purpose, destination district) for each; purpose 0 work, 1 shops, 2 lorries.
  share(job, o, put) {
    const dist = this.dist, done = this.done, gen = this.gen;
    const H = job.H[o] - job.tr[o], add = (wts, total, why) => {
      let sum = 0; for (const e of wts) sum += e[1]; if (sum <= 0) return;
      for (const e of wts) put(e[0], total * e[1] / sum, why, e[2]);
    };
    if (H > 0) {
      const jw = [], sw = [];
      for (let d = 0; d < job.rep.length; d++) { const q = job.rep[d]; if (q < 0 || done[q] !== gen) continue; const dd = dist[q]; if (job.J[d]) jw.push([q, job.J[d] * Math.exp(-dd / 28), d]); if (job.S[d]) sw.push([q, job.S[d] * Math.exp(-dd / 14), d]); }
      add(jw, H, 0); add(sw, H * 0.35, 1);
    }
    if (job.F[o] > 0) { let best = -1, bd = 1e9; for (const q of job.hwEnds) if (done[q] === gen && dist[q] < bd) { bd = dist[q]; best = q; } if (best >= 0) put(best, job.F[o], 2, distOf(best)); }
  }
  finish(sim) {
    const w = this.w, f = this.flow, nx = this.next, first = this.passes === 0; let total = 0, cnt = 0;
    for (let i = 0; i < N * N; i++) {
      if (w.kind[i] !== T.ROAD) { f[i] = 0; this.load[i] = 0; continue; }
      f[i] = first ? nx[i] : f[i] * 0.5 + nx[i] * 0.5;
      this.load[i] = f[i] / this.capOf(i);
      total += f[i]; if (f[i] > 0.5) cnt++;
    }
    this.junctions();
    const jn = w.jn;
    for (let i = 0; i < N * N; i++) {
      if (w.kind[i] !== T.ROAD) { this.cost[i] = 1; continue; }
      const L = this.load[i];
      this.cost[i] = this.baseOf(i) * Math.min(5, 1 + 0.5 * Math.pow(L, 4))     // busy roads get slow fast once past capacity
        + (jn[i] === SIGNAL ? 0.3 : jn[i] ? 0.05 : 0);                          // waiting at lights, or giving way
    }
    this.lastJob = this.job;                    // kept so a road's trips can be traced later (probe)
    this.necks = this.bottlenecks();
    // a sampler so the cars on screen appear where the trips are
    const tiles = new Int32Array(cnt), cum = new Float32Array(cnt); let c = 0, run = 0;
    for (let i = 0; i < N * N; i++) if (w.kind[i] === T.ROAD && f[i] > 0.5) { run += f[i]; tiles[c] = i; cum[c++] = run; }
    this.pickTiles = tiles; this.pickCum = cum; this.total = run;
    this.job = null; this.passes++; this.version++;
    if (this.passes < 3) this.dirty = true;     // the first few passes follow each other quickly so routes settle
  }
  // Junction control from the real trips: lights only where two busy roads meet; everywhere else the busier road has
  // priority and the side roads give way. Since 0.8.7 the choice is sticky, like real lights and signs: a junction gets
  // lights after two passes in a row with both roads busy (load 0.4+) and keeps them until both roads have been quiet
  // (below 0.15) for four passes; the main road changes after two passes with the other road 1.5 times busier.
  // (Before, a load around the threshold made lights appear and vanish from one pass to the next.) w.jhot counts passes.
  // The busier road also gets the longer green (w.jsplit: the vertical road's share).
  junctions() {
    const w = this.w, f = this.flow, n = N * N;
    const jn = w.jn && w.jn.length === n ? w.jn : (w.jn = new Uint8Array(n)), sp = w.jsplit && w.jsplit.length === n ? w.jsplit : (w.jsplit = new Float32Array(n));
    const hot = w.jhot && w.jhot.length === n ? w.jhot : (w.jhot = new Uint8Array(n));
    let signals = 0, pri = 0;
    for (let i = 0; i < n; i++) {
      if (w.kind[i] !== T.ROAD) { jn[i] = 0; if (w.jfix && w.jfix[i]) delete w.jfix[i]; continue; }
      const x = i % N, y = (i / N) | 0, m = w.roadMask(x, y);
      if ((m & 1 ? 1 : 0) + (m & 2 ? 1 : 0) + (m & 4 ? 1 : 0) + (m & 8 ? 1 : 0) < 3) { jn[i] = 0; if (w.jfix && w.jfix[i]) delete w.jfix[i]; continue; }
      let fV = 0, fH = 0, lV = 0, lH = 0;
      const arm = (xx, yy, bit, vert) => {
        if (!(m & bit)) return;
        let fl, cap; if (!w.inb(xx, yy)) { fl = f[i]; cap = CAP.highway; } else { const q = yy * N + xx; fl = f[q]; cap = this.capOf(q); }
        if (vert) { fV += fl; lV = Math.max(lV, fl / cap); } else { fH += fl; lH = Math.max(lH, fl / cap); }
      };
      arm(x, y - 1, 1, true); arm(x, y + 1, 4, true); arm(x - 1, y, 8, false); arm(x + 1, y, 2, false);
      const was = jn[i], both = Math.min(lV, lH);
      let t;
      const fx = w.jfix && w.jfix[i];
      if (fx) t = fx;                                         // set by hand in the Inspector
      else if (was === SIGNAL) {                              // lights stay until the junction has been quiet a while
        hot[i] = both < 0.15 ? Math.min(250, hot[i] + 1) : 0;
        if (hot[i] >= 4) { hot[i] = 0; t = fV + fH < 1 ? defaultJunction(w, x, y) : fV >= fH ? PRI_V : PRI_H; } else t = SIGNAL;
      } else if (both >= 0.4 && (hot[i] = Math.min(250, hot[i] + 1)) >= 2) { hot[i] = 0; t = SIGNAL; }
      else {
        if (both < 0.4) hot[i] = 0;
        const want = fV + fH < 1 ? defaultJunction(w, x, y) : fV >= fH ? PRI_V : PRI_H;
        if (!was || fV + fH < 1) t = want;
        else if (want !== was && (was === PRI_V ? fH > fV * 1.5 : fV > fH * 1.5)) t = (w.jflip && w.jflip[i]) ? want : was;
        else t = was;
        const fl = w.jflip && w.jflip.length === n ? w.jflip : (w.jflip = new Uint8Array(n));
        fl[i] = want !== was && t === was && (was === PRI_V ? fH > fV * 1.5 : fV > fH * 1.5) ? 1 : 0;   // a second pass in a row switches it
      }
      jn[i] = t; sp[i] = fV + fH > 0 ? fV / (fV + fH) : 0.5;
      if (t === SIGNAL) signals++; else pri++;
    }
    this.signals = signals; this.priority = pri;
  }
  // The worst bottlenecks: stretches of jammed road (load above 0.95) joined up, worst first by trips over capacity.
  bottlenecks() {
    const w = this.w, n = N * N, L = this.load, f = this.flow, seen = new Uint8Array(n), out = [], stack = [];
    for (let s0 = 0; s0 < n; s0++) {
      if (seen[s0] || w.kind[s0] !== T.ROAD || L[s0] < 0.95 || w.hw[s0]) continue;
      seen[s0] = 1; stack.push(s0);
      let tiles = 0, over = 0, worst = s0, sx = 0, sy = 0, ave = 0, brd = 0, sig = 0; const by = [0, 0, 0, 0, 0, 0];
      while (stack.length) {
        const c = stack.pop(), x = c % N, y = (c / N) | 0;
        tiles++; over += Math.max(0, f[c] - this.capOf(c)); sx += x; sy += y; if (L[c] > L[worst]) worst = c;
        if (w.terrain[c] === TERRAIN.WATER) brd++; else if (w.level[c] === 1) ave++;
        if (w.jn && w.jn[c] === SIGNAL) sig++;
        for (const [dx, dy] of D4) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const q = yy * N + xx, k = w.kind[q];
          if (k === T.RES || k === T.COM || k === T.IND) by[k]++;
          if (!seen[q] && k === T.ROAD && L[q] >= 0.95 && !w.hw[q]) { seen[q] = 1; stack.push(q); }
        }
      }
      if (over < 4) continue;
      out.push({ tile: worst, x: worst % N, y: (worst / N) | 0, cx: sx / tiles, cy: sy / tiles, tiles, over: Math.round(over), load: L[worst], trips: Math.round(f[worst]), cap: this.capOf(worst),
        kind: brd * 2 >= tiles ? 'bridge' : ave * 2 >= tiles ? 'avenue' : 'street', signals: sig,
        by: by[T.COM] >= by[T.RES] && by[T.COM] >= by[T.IND] && by[T.COM] ? 'shops' : by[T.IND] >= by[T.RES] && by[T.IND] ? 'industry' : by[T.RES] ? 'homes' : '' });
    }
    return out.sort((a, b) => b.over - a.over).slice(0, 5);
  }

  // ---- tracing one road's trips (the Inspector's "where do they come from and go to") ----
  // Re-runs the last pass's districts with today's travel times, and for each one counts the trips whose quickest route
  // crosses the chosen tile: by the district they start in, the district they go to, and what for. Spread over frames.
  probeFor(i) {
    const pr = this.pr;
    if (pr && pr.tile === i) { if (pr.done && pr.ver !== this.version && !this.pq && this.lastJob) this.startProbe(i, pr); return pr; }
    if (!this.lastJob) return null;
    return this.startProbe(i, null);
  }
  startProbe(i, keep) {
    const nd = DN * DN, job = this.lastJob;
    const fresh = { tile: i, ver: this.version, from: new Float32Array(nd), to: new Float32Array(nd), why: [0, 0, 0], total: 0, done: false };
    this.pq = { job, k: 0, res: fresh, sub: this.sub || (this.sub = new Int32Array(N * N)) };
    if (!keep) this.pr = fresh;               // a re-run keeps showing the old answer until the new one is ready
    return this.pr;
  }
  stopProbe() { this.pq = null; this.pr = null; }
  probeStep(ms) {
    const pq = this.pq, job = pq.job, res = pq.res, r = res.tile, t0 = performance.now();
    if (this.w.kind[r] !== T.ROAD) { this.pq = null; return; }
    while (pq.k < job.origins.length && performance.now() - t0 < ms) {
      const o = job.origins[pq.k++], s0 = job.rep[o]; if (s0 < 0 || this.w.kind[s0] !== T.ROAD) continue;
      const settled = this.tree(s0), gen = this.gen; if (this.done[r] !== gen) continue;
      const sub = pq.sub, prev = this.prev, order = this.order;
      for (let k = 0; k < settled; k++) { const c = order[k]; sub[c] = c === r || (prev[c] >= 0 && sub[prev[c]] === gen) ? gen : 0; }
      this.share(job, o, (q, a, why, d) => { if (sub[q] !== gen) return; res.from[o] += a; res.to[d] += a; res.why[why] += a; res.total += a; });
    }
    if (pq.k >= job.origins.length) { res.done = true; this.pr = res; this.pq = null; }
  }
  pick(r) {                                   // a road tile, chosen in proportion to its traffic (r in 0..1)
    const cum = this.pickCum; if (!cum.length) return -1;
    const v = r * this.total; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < v) lo = m + 1; else hi = m; }
    return this.pickTiles[lo];
  }
}
