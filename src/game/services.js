// Services you can see working (0.8.11): police cars patrolling around their stations, ambulances out to homes and back,
// fire engines on inspection runs, school buses and children walking to school and home again, and goods lorries from
// the factories to the shops and out to the highway. Nothing here changes the game; it only shows what the city does.
// Every trip is a real road path (one breadth-first search over the roads, at most one per frame) driven out and back,
// or one way for children and lorries leaving the city. Children are skipped on Smooth graphics.
import { Mover } from './cars.js';
import { N, T } from './world.js';
import { BT } from './buildings.js';

const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const POLICE = new Set([4, 8]), FIRE = new Set([5, 9]), HEALTH = new Set([6, 10]), SCHOOL = new Set([7]);
const LORRY_COLS = ['#e07a2e', '#3d6fb0', '#8a9099', '#c9372c', '#e0b526', '#4f6f5a'];
const MAX_STEPS = 140;                                   // longest trip, in road tiles

export class Services extends Mover {
  constructor(game, rnd) {
    super(game.world, rnd); this.g = game; this.scanT = -99; this.timers = {}; this.pl = null;
    const n = N * N; this.seen = new Uint32Array(n); this.goal = new Uint32Array(n); this.par = new Int32Array(n); this.q = new Int32Array(n); this.stamp = 0;
  }
  get vehicles() { return this.list; }

  // ---- what stands where (every 5 s) ----
  scan() {
    const w = this.w, s = this.g.sim, pl = { police: [], fire: [], health: [], school: [], coal: [], homes: [], shops: [], works: [], edge: [] };
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i], x = i % N, y = (i / N) | 0;
      if (k === T.SVC && w.bo[i] === 0 && !s.pending.has(i) && !(s.isClosedAt && s.isClosedAt(i))) {
        const id = w.bt[i], def = BT[id], e = { x, y, w: def.w, d: def.d, r: def.radius || 8, hq: def.w > 1 };
        if (id === 1) pl.coal.push(e); else if (POLICE.has(id)) pl.police.push(e); else if (FIRE.has(id)) pl.fire.push(e); else if (HEALTH.has(id)) pl.health.push(e); else if (SCHOOL.has(id)) pl.school.push(e);
      } else if (w.level[i] && !s.pending.has(i) && !(s.aband && s.aband[i])) {
        if (k === T.RES) pl.homes.push(i); else if (k === T.COM) pl.shops.push(i); else if (k === T.IND) pl.works.push(i);
      }
      if (k === T.ROAD && w.hw[i] && (x === 0 || y === 0 || x === N - 1 || y === N - 1)) pl.edge.push(i);
    }
    this.pl = pl;
  }

  // ---- roads ----
  beside(x, y, fw, fd) {
    const out = [];
    for (let yy = y - 1; yy <= y + fd; yy++) for (let xx = x - 1; xx <= x + fw; xx++) {
      if ((xx === x - 1 || xx === x + fw) === (yy === y - 1 || yy === y + fd)) continue;   // not the corners, not the lot itself
      if (this.w.isRoad(xx, yy)) out.push(yy * N + xx);
    }
    return out;
  }
  besideTile(i) { return this.beside(i % N, (i / N) | 0, 1, 1); }
  // quickest road path from any of `srcs` to any of `goals`, or null
  path(srcs, goals) {
    if (!srcs.length || !goals.length) return null;
    const w = this.w, seen = this.seen, goal = this.goal, par = this.par, q = this.q, st = ++this.stamp, dist = this.dist || (this.dist = new Int32Array(N * N));
    for (const g of goals) goal[g] = st;
    let h = 0, tl = 0;
    for (const s of srcs) { if (seen[s] === st) continue; seen[s] = st; par[s] = -1; dist[s] = 0; q[tl++] = s; }
    while (h < tl) {
      const c = q[h++];
      if (goal[c] === st) { const p = []; for (let k = c; k >= 0; k = par[k]) p.push(k); return p.reverse(); }
      if (dist[c] >= MAX_STEPS) continue;
      const x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const r = yy * N + xx; if (seen[r] === st || w.kind[r] !== T.ROAD || (w.fix && w.fix[r] === 2)) continue; seen[r] = st; par[r] = c; dist[r] = dist[c] + 1; q[tl++] = r; }
    }
    return null;
  }
  near(list, cx, cy, R, tries = 24) {     // a random entry of `list` (tile indices) within R tiles of (cx, cy)
    if (!list.length) return -1;
    for (let t = 0; t < tries; t++) { const i = list[Math.floor(this.rnd() * list.length)]; if (Math.hypot((i % N) - cx, ((i / N) | 0) - cy) <= R) return i; }
    return -1;
  }
  roadNear(cx, cy, R) {
    for (let t = 0; t < 30; t++) {
      const x = Math.round(cx + (this.rnd() * 2 - 1) * R), y = Math.round(cy + (this.rnd() * 2 - 1) * R);
      if (this.w.isRoad(x, y) && !this.w.hw[y * N + x] && Math.hypot(x - cx, y - cy) <= R) return y * N + x;
    }
    return -1;
  }
  // a vehicle (or person) at the start of `path`, heading along it
  put(path, o) {
    if (!path || path.length < 3) return null;
    const a = path[0], b = path[1], x = a % N, y = (a / N) | 0, d = D4.findIndex((v) => v[0] === (b % N) - x && v[1] === ((b / N) | 0) - y);
    if (d < 0) return null;
    const c = { tx: x, ty: y, d, t: 0.05, speed: 0.9, col: Math.floor(this.rnd() * 8), px: x + 0.5, py: y + 0.5, dx: D4[d][0], dy: D4[d][1], off: 0.13, path, pi: 0, dir: 1, maxTrips: 1, ...o };
    this.list.push(c); return c;
  }

  // ---- one kind of trip each ----
  police(e) {
    const to = this.roadNear(e.x + e.w / 2, e.y + e.d / 2, e.r); if (to < 0) return;
    const fast = this.rnd() < 0.15;                       // now and then a call: lights on, a bit quicker
    this.put(this.path(this.beside(e.x, e.y, e.w, e.d), [to]), { kind: 'police', police: true, siren: fast, speed: fast ? 1.45 : 0.85 + this.rnd() * 0.2, waitAt: fast ? 3 : 0 });
  }
  ambulance(e) {
    const home = this.near(this.pl.homes, e.x + e.w / 2, e.y + e.d / 2, e.r + 4); if (home < 0) return;
    this.put(this.path(this.beside(e.x, e.y, e.w, e.d), this.besideTile(home)), { kind: 'amb', truck: true, amb: true, body: '#f4f4f2', cab: '#f4f4f2', siren: true, speed: 1.35, waitAt: 5 });
  }
  inspection(e) {
    const to = this.near(this.pl.shops.length && this.rnd() < 0.6 ? this.pl.shops : this.pl.works, e.x + e.w / 2, e.y + e.d / 2, e.r); if (to < 0) return;
    this.put(this.path(this.beside(e.x, e.y, e.w, e.d), this.besideTile(to)), { kind: 'fire', truck: true, fire: true, quiet: true, speed: 0.75, waitAt: 6 });
  }
  schoolBus(e) {
    const home = this.near(this.pl.homes, e.x + 0.5, e.y + 0.5, 10); if (home < 0) return;
    this.put(this.path(this.beside(e.x, e.y, 1, 1), this.besideTile(home)), { kind: 'sbus', bus: true, col: '#f2b705', speed: 0.7, waitAt: 3 });
  }
  child(e, going) {
    const home = this.near(this.pl.homes, e.x + 0.5, e.y + 0.5, 9); if (home < 0) return;
    const a = this.besideTile(home), b = this.beside(e.x, e.y, 1, 1);
    this.put(going ? this.path(a, b) : this.path(b, a), { kind: 'kid', ped: true, kid: true, maxTrips: 0, speed: 0.3 + this.rnd() * 0.12, off: (this.rnd() < 0.5 ? -1 : 1) * 0.43, t: this.rnd() * 0.5 });
  }
  lorry() {
    const pl = this.pl, f = pl.works[Math.floor(this.rnd() * pl.works.length)], fx = f % N, fy = (f / N) | 0, src = this.besideTile(f);
    const goods = this.g.sim.goods || {}, local = goods.made > 0 ? goods.local / goods.made : 0.6;
    const col = LORRY_COLS[Math.floor(this.rnd() * LORRY_COLS.length)];
    if (pl.shops.length && (this.rnd() < Math.max(0.35, local) || !pl.edge.length)) {
      const shop = this.near(pl.shops, fx, fy, 26); if (shop < 0) return;
      this.put(this.path(src, this.besideTile(shop)), { kind: 'lorry', truck: true, lorry: true, body: col, speed: 0.7, waitAt: 4 });
    } else if (pl.edge.length) this.put(this.path(src, pl.edge), { kind: 'lorry', truck: true, lorry: true, body: col, speed: 0.75, maxTrips: 0 });   // goods for the region: off down the highway
  }

  coalRun(e) {                            // 0.9.0: coal comes to the power plant by lorry from the highway
    if (!this.pl.edge.length) return;
    this.put(this.path(this.pl.edge, this.beside(e.x, e.y, e.w, e.d)), { kind: 'coal', truck: true, lorry: true, body: '#2f3136', speed: 0.75, waitAt: 4 });
  }
  // ---- every frame ----
  update(dt, rhy) {
    const g = this.g, s = g.sim;
    if (!s) return;
    const now = performance.now() / 1000;
    if (now - this.scanT > 5 || !this.pl) { this.scanT = now; this.scan(); }
    if (dt > 0) {
      for (const c of this.list) if (c.park) { c.park -= dt; if (c.park <= 0) c.park = 0; }
      const pl = this.pl, cnt = {}; for (const c of this.list) cnt[c.kind] = (cnt[c.kind] || 0) + 1;
      const tm = this.timers, due = (k, every) => { tm[k] = (tm[k] || 0) + dt; if (tm[k] < every) return false; tm[k] = 0; return true; };
      const pick = (a) => a[Math.floor(this.rnd() * a.length)];
      const holidays = s.month === 6 || s.month === 7;
      // at most one road search a frame: the first kind that is short and due gets it
      const want = [
        ['police', Math.min(6, pl.police.reduce((a, e) => a + (e.hq ? 2 : 1), 0)), 1.5, () => this.police(pick(pl.police))],
        ['amb', pl.health.length && pl.homes.length ? Math.min(3, 1 + Math.floor(s.pop / 2500)) : 0, 9, () => this.ambulance(pick(pl.health))],
        ['fire', pl.fire.length && rhy.hour > 8 && rhy.hour < 18 && !rhy.weekend ? Math.min(2, Math.ceil(pl.fire.length / 2)) : 0, 20, () => this.inspection(pick(pl.fire))],
        ['sbus', rhy.school && !holidays ? Math.min(4, pl.school.length) : 0, 2.5, () => this.schoolBus(pick(pl.school))],
        ['kid', rhy.school && !holidays && !g.fast ? Math.min(24, pl.school.length * 8, Math.floor(pl.homes.length / 2)) : 0, 0.35, () => this.child(pick(pl.school), rhy.school === 1)],
        ['coal', pl.coal.length ? Math.min(4, pl.coal.length * 2) : 0, 4, () => this.coalRun(pick(pl.coal))],
        ['lorry', pl.works.length ? Math.round(Math.min(8, 1 + pl.works.length / 5) * Math.max(0.15, rhy.weekend ? rhy.work * 2 : Math.max(rhy.work, rhy.shop * 0.6))) : 0, 2, () => this.lorry()],
      ];
      for (const [k, target, every, go] of want) if ((cnt[k] || 0) < target && due(k, every)) { go(); break; }
    }
    this.step(dt, 0);
  }
}
