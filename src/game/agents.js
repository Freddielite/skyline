// Citizens with homes, jobs and daily routines. They walk or drive real routes along the roads.
import { N, T } from './world.js';
import { BT } from './buildings.js';
import { POP_CAP, COM_CAP, IND_CAP } from './sim.js';
import { mustStop } from './traffic.js';

const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const WALK = 0.55, DRIVE = 1.7, CAR_ABOVE = 7;       // tiles per second, trip length (tiles) above which people drive
const rr = (r, a, b) => a + r() * (b - a);

export class Agents {
  constructor(world, rnd, busy) {
    this.w = world; this.rnd = rnd; this.busy = busy || (() => false);
    this.list = []; this.walkers = []; this.drivers = []; this.cache = new Map();
    this.homes = []; this.jobs = []; this.spots = []; this.jobAt = new Map(); this.refreshT = 99; this.stats = { employed: 0, moving: 0, total: 0, riding: 0 };
    this.transit = null; this.sigT = 0;
  }

  // ---- what exists in the city ----
  refresh() {
    const w = this.w, homes = [], jobs = [], spots = [];
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i], l = w.level[i], x = i % N, y = (i / N) | 0;
      if (k === T.RES && l && !this.busy(i)) homes.push({ i, x, y, w: 1, d: 1, cap: POP_CAP[l] });
      else if ((k === T.COM || k === T.IND) && l && !this.busy(i)) jobs.push({ i, x, y, w: 1, d: 1, shop: k === T.COM, slots: Math.max(1, Math.ceil((k === T.COM ? COM_CAP[l] : IND_CAP[l]) / 4)), used: 0 });
      else if (k === T.PARK) spots.push({ i, x, y, w: 1, d: 1, park: true });
      else if (k === T.SVC && w.bo[i] === 0) { const def = BT[w.bt[i]]; if (def && def.cat === 'fun' && !this.busy(i)) spots.push({ i, x, y, w: def.w, d: def.d }); }
    }
    this.homes = homes; this.jobs = jobs; this.spots = spots; this.cache.clear();
    this.jobAt = new Map(jobs.map((j) => [j.i, j]));
    this.homeAt = new Map(homes.map((h) => [h.i, h]));
    for (const a of this.list) {
      a.home = this.homeAt.get(a.home.i) || null;
      if (a.work) { const j = this.jobAt.get(a.work.i); if (j && j.used < j.slots) { j.used++; a.work = j; } else { a.work = null; } }
    }
    this.list = this.list.filter((a) => a.home);
    for (const a of this.list) if (!a.work && this.jobs.length && this.rnd() < 0.6) this.giveJob(a);
  }
  giveJob(a) {
    const open = this.jobs.filter((j) => j.used < j.slots);
    if (!open.length) { a.work = null; return; }
    const j = open[Math.floor(this.rnd() * open.length)]; j.used++; a.work = j;
  }

  // ---- routes ----
  access(b) {
    const w = this.w; let best = -1, bd = 1e9;
    const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
    for (let y = b.y - 3; y < b.y + b.d + 3; y++) for (let x = b.x - 3; x < b.x + b.w + 3; x++) {
      if (!w.isRoad(x, y)) continue;
      const d = Math.abs(x + 0.5 - cx) + Math.abs(y + 0.5 - cy); if (d < bd) { bd = d; best = y * N + x; }
    }
    return best;
  }
  bfs(s, e) {
    const key = s * N * N + e, hit = this.cache.get(key); if (hit !== undefined) return hit;
    const w = this.w, prev = new Int16Array(N * N).fill(-1), q = [s]; prev[s] = s;
    for (let h = 0; h < q.length; h++) {
      const c = q[h]; if (c === e) break;
      const x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (!w.isRoad(xx, yy)) continue; const n = yy * N + xx; if (prev[n] < 0) { prev[n] = c; q.push(n); } }
    }
    let out = null;
    if (prev[e] >= 0) { out = []; for (let c = e; c !== s; c = prev[c]) out.push(c); out.push(s); out.reverse(); }
    if (this.cache.size > 800) this.cache.clear();
    this.cache.set(key, out); return out;
  }
  route(a, b) {
    const sa = this.access(a), sb = this.access(b); if (sa < 0 || sb < 0) return null;
    const rp = sa === sb ? [sa] : this.bfs(sa, sb); if (!rp) return null;
    const c = (i) => [(i % N) + 0.5, ((i / N) | 0) + 0.5], ctr = (o) => [o.x + o.w / 2, o.y + o.d / 2];
    const pts = [], A = ctr(a), B = ctr(b), fa = c(sa), fb = c(sb);
    pts.push(a.park ? A : [(A[0] + fa[0]) / 2, (A[1] + fa[1]) / 2]);
    for (const i of rp) pts.push(c(i));
    pts.push(b.park ? B : [(B[0] + fb[0]) / 2, (B[1] + fb[1]) / 2]);
    return pts;
  }

  // ---- population of agents ----
  spawn(hour, day) {
    if (!this.homes.length) return;
    let tot = 0; for (const h of this.homes) tot += h.cap;
    let r = this.rnd() * tot, home = this.homes[0]; for (const h of this.homes) { r -= h.cap; if (r <= 0) { home = h; break; } }
    const rn = this.rnd, a = {
      home, work: null, col: Math.floor(rn() * 8), st: 'home', vis: false, ped: true, idle: false, px: 0, py: 0, dx: 1, dy: 0,
      goWork: rr(rn, 6.8, 8.9), endWork: rr(rn, 16.3, 18.4), hasCar: rn() < 0.7, side: rn() < 0.5 ? -1 : 1,
      workedDay: -1, outDay: -1, plan: null, pts: null, seg: 0, t: 0, speed: WALK, stayUntil: 0, wander: null,
    };
    this.giveJob(a);
    a.plan = a.work ? (rn() < 0.5 ? { at: rr(rn, 18.2, 20.2) } : null) : { at: rr(rn, 9.5, 17) };
    if (a.work && hour > a.goWork + 1.5 && hour < a.endWork) { a.st = 'work'; a.workedDay = day; }
    else if (a.work && hour >= a.endWork) a.workedDay = day;
    this.list.push(a);
  }

  // ---- trips ----
  go(a, dest, st, abs) {
    const src = st === 'toHome' ? (a.st === 'out' ? a.spot : a.work) : a.st === 'out' ? a.spot : a.home;
    const from = src || a.home;
    const pts = this.route(from, dest); if (!pts) return false;
    const tiles = pts.length - 2;
    a.vis = true; a.idle = false; a.still = false;
    // long trips without a car (or by choice) go by bus when stops are close at both ends
    if (tiles > 9 && this.transit && this.transit.ready && (!a.hasCar || this.rnd() < 0.12)) {
      const plan = this.transit.plan(from, dest);
      const p1 = plan && this.route(from, plan.A);
      if (p1) {
        a.plan = { A: plan.A, B: plan.B, dest, final: st }; a.pts = p1; a.seg = 0; a.t = 0; a.st = 'toStop';
        a.ped = true; a.speed = WALK * (0.9 + this.rnd() * 0.25); a.dest = dest; return true;
      }
    }
    a.pts = pts; a.seg = 0; a.t = 0; a.st = st; a.plan = null;
    a.ped = !(a.hasCar && tiles > CAR_ABOVE); a.speed = a.ped ? WALK * (0.9 + this.rnd() * 0.25) : DRIVE * (0.85 + this.rnd() * 0.3);
    a.dest = dest; return true;
  }
  arrive(a, abs) {
    a.vis = false; a.pts = null; a.idle = false; a.still = false;
    if (a.st === 'toStop') {
      const A = a.plan.A; a.st = 'waiting'; a.vis = true; a.still = true; a.ped = true; a.waitUntil = abs + 3;
      a.px = A.x + A.w / 2 + rr(this.rnd, -0.25, 0.25); a.py = A.y + A.d / 2 + rr(this.rnd, -0.25, 0.25); return;
    }
    if (a.st === 'fromStop') { a.st = a.plan.final; a.plan = null; }
    if (a.st === 'toWork') a.st = 'work';
    else if (a.st === 'toHome') a.st = 'home';
    else if (a.st === 'toOut') {
      a.st = 'out'; a.stayUntil = abs + rr(this.rnd, 0.8, 2.0);
      if (a.spot && a.spot.park) { a.vis = true; a.idle = true; a.ped = true; a.px = a.spot.x + 0.5; a.py = a.spot.y + 0.5; a.wander = null; }
    }
  }
  pickSpot(a) {
    const shops = this.jobs.filter((j) => j.shop), big = this.spots.filter((p) => !p.park && p.w >= 2), pool = this.spots.concat(shops, shops, big, big);
    if (!pool.length) return null;
    return pool[Math.floor(this.rnd() * pool.length)];
  }

  think(a, hour, day, abs) {
    if (a.st === 'home') {
      if (a.work && a.workedDay !== day && hour >= a.goWork && hour < a.endWork - 1) { a.workedDay = day; if (this.go(a, a.work, 'toWork', abs)) return; }
      if (a.plan && a.outDay !== day && hour >= a.plan.at && hour < 21.5) {
        a.outDay = day; const sp = this.pickSpot(a);
        if (sp) { a.spot = sp; this.go(a, sp, 'toOut', abs); }
      }
    } else if (a.st === 'work') {
      if (hour >= a.endWork || hour < a.goWork - 2) this.go(a, a.home, 'toHome', abs);
    } else if (a.st === 'waiting') {
      if (abs >= a.waitUntil) {                            // no bus came: walk the whole way
        const pts = this.route(a.plan.A, a.plan.dest);
        if (pts) { a.pts = pts; a.seg = 0; a.t = 0; a.st = 'fromStop'; a.vis = true; a.still = false; a.ped = true; } else { a.st = a.plan.final === 'toWork' ? 'work' : 'home'; a.vis = false; a.plan = null; }
      }
    } else if (a.st === 'out') {
      if (abs >= a.stayUntil || hour >= 22.5) { if (!this.go(a, a.home, 'toHome', abs)) { a.st = 'home'; a.vis = false; } }
    }
  }

  move(a, dist, abs) {
    const p = a.pts;
    if (a.hold && !a.ped) dist = 0;                                   // queueing behind another vehicle
    while (dist > 0 && a.pts) {
      const A = p[a.seg], B = p[a.seg + 1], len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 0.001, left = (1 - a.t) * len;
      if (!a.ped && a.seg + 1 < p.length - 1 && a.t < 0.46 && (1 - a.t) * len > 0) {      // stop line before a red signal
        const ux = Math.sign(B[0] - A[0]), uy = Math.sign(B[1] - A[1]);
        if (mustStop(this.w, Math.floor(B[0]), Math.floor(B[1]), ux, uy, this.sigT) && a.t + dist / len > 0.46) { dist = Math.max(0, (0.46 - a.t) * len); a.t = Math.min(0.46, a.t + dist / len); dist = 0; break; }
      }
      if (dist < left) { a.t += dist / len; dist = 0; }
      else { dist -= left; a.seg++; a.t = 0; if (a.seg >= p.length - 1) { this.arrive(a, abs); return; } }
    }
    if (!a.pts) return;
    const A = p[a.seg], B = p[a.seg + 1], ax = B[0] - A[0], ay = B[1] - A[1];
    if (Math.abs(ax) >= Math.abs(ay)) { a.dx = Math.sign(ax) || 1; a.dy = 0; } else { a.dx = 0; a.dy = Math.sign(ay) || 1; }
    const edge = a.seg === 0 || a.seg === p.length - 2, off = edge ? 0 : (a.ped ? a.side * 0.43 : 0.13);
    a.px = A[0] + ax * a.t - a.dy * off; a.py = A[1] + ay * a.t + a.dx * off;
  }

  wander(a, dt) {
    const s = a.spot; if (!s) return;
    if (!a.wander || Math.hypot(a.wander[0] - a.px, a.wander[1] - a.py) < 0.03) a.wander = [s.x + 0.5 + rr(this.rnd, -0.3, 0.3), s.y + 0.5 + rr(this.rnd, -0.3, 0.3)];
    const dx = a.wander[0] - a.px, dy = a.wander[1] - a.py, d = Math.hypot(dx, dy) || 1, v = Math.min(d, 0.12 * dt);
    a.px += (dx / d) * v; a.py += (dy / d) * v;
  }

  // dt: game-time seconds, realDt: wall seconds, abs: absolute clock hours
  update(dt, realDt, abs, target, sigT = 0) {
    this.sigT = sigT;
    const hour = abs % 24, day = Math.floor(abs / 24);
    this.refreshT += realDt;
    if (this.refreshT > 2) { this.refreshT = 0; this.refresh(); }
    // keep the head-count in line with the population
    if (this.list.length < target && this.homes.length) { for (let k = 0; k < 2 && this.list.length < target; k++) this.spawn(hour, day); }
    else if (this.list.length > target) { const k = this.list.findIndex((a) => !a.vis); if (k >= 0) this.list.splice(k, 1); }
    let moving = 0, emp = 0, riding = 0;
    this.walkers.length = 0; this.drivers.length = 0;
    for (const a of this.list) {
      if (a.work) emp++;
      if (dt > 0) {
        if (a.pts) this.move(a, a.speed * dt, abs);
        else this.think(a, hour, day, abs);
        if (a.idle) this.wander(a, dt);
      }
      if (a.st === 'riding') riding++;
      if (a.vis) { moving++; (a.ped ? this.walkers : this.drivers).push(a); }
    }
    this.stats = { employed: emp, moving, total: this.list.length, riding };
  }
}
