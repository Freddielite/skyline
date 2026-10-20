// Bus network: every terminal runs a loop through the stops it can reach. Citizens without a car wait at a stop and ride.
import { N, T } from './world.js';
import { BT } from './buildings.js';
import { mustStop } from './traffic.js';

const LINES = ['#e8a521', '#3a9d6e', '#2e86c1', '#c0392b', '#8e44ad'];
const WALK = 0.55;
const vp = (i) => [(i % N) + 0.5, ((i / N) | 0) + 0.5];

export class Transit {
  constructor(world, sim, agents, rnd) {
    this.w = world; this.sim = sim; this.agents = agents; this.rnd = rnd;
    this.stops = []; this.terms = []; this.buses = []; this.ready = false; this.sig = ''; this.scanT = 99;
  }
  scan() {
    const w = this.w, stops = [], terms = [];
    for (let i = 0; i < N * N; i++) {
      if (w.kind[i] !== T.SVC || w.bo[i] !== 0 || this.sim.pending.has(i)) continue;
      const bt = w.bt[i]; if (bt !== 21 && bt !== 22) continue;
      const d = BT[bt], o = { x: i % N, y: (i / N) | 0, w: d.w, d: d.d, i, bt };
      (bt === 22 ? terms : stops).push(o);
    }
    this.stops = stops; this.terms = terms;
  }
  rebuild() {
    const ag = this.agents;
    for (const a of ag.list) if (a.st === 'riding') { a.st = 'home'; a.vis = false; a.plan = null; a.bus = null; }
    this.buses = []; this.ready = false;
    const nodes = this.terms.concat(this.stops).map((s) => ({ s, acc: ag.access(s) })).filter((n) => n.acc >= 0);
    let line = 0;
    for (const term of nodes.filter((n) => n.s.bt === 22)) {
      if (!this.sim.pw[term.s.i]) continue;                      // an unpowered terminal runs no buses
      const rest = nodes.filter((n) => n.s.bt === 21 && ag.bfs(term.acc, n.acc)), order = [term];
      let cur = term;
      while (rest.length) {
        let bi = 0, bd = 1e9;
        rest.forEach((n, i) => { const d = Math.abs(n.s.x - cur.s.x) + Math.abs(n.s.y - cur.s.y); if (d < bd) { bd = d; bi = i; } });
        cur = rest.splice(bi, 1)[0]; order.push(cur);
      }
      const verts = [], stopAt = new Map();
      for (let k = 0; k < order.length; k++) {
        const A = order[k], B = order[(k + 1) % order.length];
        const path = A.acc === B.acc ? [A.acc] : ag.bfs(A.acc, B.acc); if (!path) continue;
        if (!verts.length) { verts.push(path[0]); stopAt.set(0, A.s); }
        for (let q = 1; q < path.length; q++) verts.push(path[q]);
        stopAt.set(verts.length - 1, B.s);
      }
      if (verts.length > 1 && verts[verts.length - 1] === verts[0]) { verts.pop(); stopAt.set(0, term.s); for (const [k] of stopAt) if (k >= verts.length) stopAt.delete(k); }
      if (verts.length < 2) continue;
      const ids = new Set(order.map((n) => n.s.i)), count = order.length > 2 ? 2 : 1, col = LINES[line++ % LINES.length];
      for (let c = 0; c < count; c++) {
        const seg = Math.floor((c * verts.length) / count);
        this.buses.push({ bus: true, verts, stopAt, ids, seg, t: 0, speed: 1.5, dwell: 0, load: 0, hold: false, px: 0, py: 0, dx: 1, dy: 0, col, term: term.s });
      }
    }
    this.ready = this.buses.length > 0;
  }
  // choose the stops a trip from one building to another would use
  plan(from, dest) {
    if (!this.ready) return null;
    const near = (o) => {
      let best = null, bd = 9;
      for (const s of this.stops.concat(this.terms)) {
        if (!this.buses.some((b) => b.ids.has(s.i))) continue;
        const d = Math.abs(s.x + s.w / 2 - (o.x + o.w / 2)) + Math.abs(s.y + s.d / 2 - (o.y + o.d / 2)); if (d < bd) { bd = d; best = s; }
      }
      return best;
    };
    const A = near(from), B = near(dest);
    if (!A || !B || A.i === B.i || !this.buses.some((b) => b.ids.has(A.i) && b.ids.has(B.i))) return null;
    return { A, B };
  }
  dwellAt(b, stop) {
    b.dwell = 4.5;
    const ag = this.agents;
    for (const a of ag.list) {
      if (a.st === 'riding' && a.bus === b && a.plan && a.plan.B.i === stop.i) {                    // get off and walk on
        b.load--; a.bus = null;
        const pts = ag.route(stop, a.plan.dest);
        if (pts) { a.pts = pts; a.seg = 0; a.t = 0; a.st = 'fromStop'; a.vis = true; a.ped = true; a.still = false; a.speed = WALK; a.px = pts[0][0]; a.py = pts[0][1]; }
        else { a.st = a.plan.final === 'toWork' ? 'work' : 'home'; a.vis = false; a.plan = null; }
      }
    }
    for (const a of ag.list) {
      if (b.load >= 18) break;
      if (a.st === 'waiting' && a.plan && a.plan.A.i === stop.i && b.ids.has(a.plan.B.i)) { a.st = 'riding'; a.bus = b; a.vis = false; a.still = false; b.load++; }
    }
  }
  update(dt, realDt, sigT) {
    this.scanT += realDt;
    if (this.scanT > 2) {
      this.scanT = 0; this.scan();
      const sig = this.terms.map((t) => t.i + (this.sim.pw[t.i] ? 'p' : 'x')).join(',') + '|' + this.stops.map((s) => s.i).join(',') + '|' + this.sim.roads;
      if (sig !== this.sig) { this.sig = sig; this.rebuild(); }
    }
    if (dt <= 0) return;
    const w = this.w;
    for (const b of this.buses) {
      if (b.dwell > 0) { b.dwell -= dt; this.place(b); continue; }
      let dist = b.hold ? 0 : b.speed * dt; const n = b.verts.length;
      while (dist > 0) {
        const A = vp(b.verts[b.seg]), nb = b.verts[(b.seg + 1) % n], B = vp(nb), len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, left = (1 - b.t) * len;
        if (b.t < 0.46 && mustStop(w, nb % N, (nb / N) | 0, Math.sign(B[0] - A[0]), Math.sign(B[1] - A[1]), sigT) && b.t + dist / len > 0.46) { b.t = 0.46; dist = 0; break; }
        if (dist < left) { b.t += dist / len; dist = 0; }
        else { dist -= left; b.seg = (b.seg + 1) % n; b.t = 0; const st = b.stopAt.get(b.seg); if (st) { this.dwellAt(b, st); dist = 0; break; } }
      }
      this.place(b);
    }
  }
  place(b) {
    const n = b.verts.length, A = vp(b.verts[b.seg]), B = vp(b.verts[(b.seg + 1) % n]), ax = B[0] - A[0], ay = B[1] - A[1];
    if (Math.abs(ax) >= Math.abs(ay)) { b.dx = Math.sign(ax) || 1; b.dy = 0; } else { b.dx = 0; b.dy = Math.sign(ay) || 1; }
    b.px = A[0] + ax * b.t - b.dy * 0.13; b.py = A[1] + ay * b.t + b.dx * 0.13;
  }
}
