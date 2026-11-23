import { N } from './world.js';
import { mustStop } from './traffic.js';
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class Mover {
  constructor(world, rnd) { this.w = world; this.rnd = rnd; this.list = []; this.timer = 0; }
  openDirs(x, y, not) {
    const out = [];
    for (let d = 0; d < 4; d++) if (d !== not && this.w.isRoad(x + DIRS[d][0], y + DIRS[d][1]) && !(this.w.fix && this.w.fix[(y + DIRS[d][1]) * N + x + DIRS[d][0]] === 2)) out.push(d);   // not into a road closed for repairs
    return out;
  }
  nearBuilt(x, y, r) {
    const w = this.w;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (!w.inb(x + i, y + j)) continue;
      const q = w.idx(x + i, y + j), k = w.kind[q];
      if (k >= 2 && k <= 4 && w.level[q] > 0) return true;
    }
    return false;
  }
  spawn(needBuilt) {
    const w = this.w;
    for (let t = 0; t < 60; t++) {
      const x = Math.floor(this.rnd() * N), y = Math.floor(this.rnd() * N);
      if (!w.isRoad(x, y)) continue;
      if (needBuilt && !this.nearBuilt(x, y, 2)) continue;
      const od = this.openDirs(x, y, -1);
      if (!od.length) continue;
      const d = od[Math.floor(this.rnd() * od.length)];
      return this.make(x, y, d);
    }
    return null;
  }
  // Along a fixed road path (tile indices): head for the next tile; at either end turn round and drive back. A path tile that
  // is no longer next to this one (a road was removed) ends the trip.
  follow(c) {
    const p = c.path, cur = c.ty * N + c.tx;
    if (p[c.pi] !== cur) { const j = p.indexOf(cur); if (j < 0) return false; c.pi = j; }
    if (c.pi + c.dir < 0 || c.pi + c.dir >= p.length) {
      c.trips = (c.trips || 0) + 1; if (c.trips > (c.maxTrips ?? 6)) return false;          // garbage lorries: 6 runs; service trips: out and back
      c.dir = -c.dir;
      if (c.waitAt && c.trips === 1) { c.park = c.waitAt; c.siren = false; }               // stop a while at the far end (services.js)
    }
    const nx = p[c.pi + c.dir], dx = (nx % N) - c.tx, dy = ((nx / N) | 0) - c.ty;
    const d = DIRS.findIndex((v) => v[0] === dx && v[1] === dy); if (d < 0) return false;
    c.d = d; c.pi += c.dir; return true;
  }
  // keep the number of movers near `target`, adding/removing one at a time so changes aren't jarring
  balance(dt, target, rate) {
    this.timer += dt;
    if (this.timer < rate) return;
    this.timer = 0;
    if (this.list.length < target) { const m = this.spawn(this.needBuilt); if (m) this.list.push(m); }
    else if (this.list.length > target) this.list.splice(Math.floor(this.rnd() * this.list.length), 1);
  }
  step(dt, turnBack) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      if (!this.w.isRoad(c.tx, c.ty)) { this.list.splice(i, 1); continue; }
      let nt = c.t + (c.hold || c.park ? 0 : dt * c.speed);   // hold: queueing (followPass); park: stopped on a job (services.js)
      const nx = c.tx + DIRS[c.d][0], ny = c.ty + DIRS[c.d][1];
      if (nt > 0.8 && c.t <= 0.8 && !c.siren && mustStop(this.w, nx, ny, DIRS[c.d][0], DIRS[c.d][1], this.sigT || 0, c)) nt = 0.8;   // wait at the stop line
      c.t = nt;
      while (c.t >= 1) {
        c.t -= 1;
        c.tx += DIRS[c.d][0]; c.ty += DIRS[c.d][1];
        if (!this.w.isRoad(c.tx, c.ty)) { c.dead = true; break; }
        if (c.path) { if (!this.follow(c)) { c.dead = true; break; } continue; }   // a lorry on its route (transfer stations, 0.8.10)
        const back = (c.d + 2) % 4;
        let od = this.openDirs(c.tx, c.ty, back);
        if (!od.length) od = [back];
        else if (turnBack && this.rnd() < turnBack) od.push(back);
        const fw = this.flowW;
        if (fw && od.length > 1) {                       // follow the traffic: busier roads are likelier, going straight a bit more so
          let sum = 0; for (const d of od) sum += (fw[(c.ty + DIRS[d][1]) * N + c.tx + DIRS[d][0]] + 2) * (d === c.d ? 1.6 : 1);
          let r = this.rnd() * sum; for (const d of od) { r -= (fw[(c.ty + DIRS[d][1]) * N + c.tx + DIRS[d][0]] + 2) * (d === c.d ? 1.6 : 1); if (r <= 0) { c.d = d; break; } }
        } else {
          const straight = od.includes(c.d) && this.rnd() < 0.65;
          c.d = straight ? c.d : od[Math.floor(this.rnd() * od.length)];
        }
        if (c.life !== undefined && --c.life <= 0) c.dead = true;      // after a while a car leaves, and a new one appears where trips are
      }
      if (c.dead) { this.list.splice(i, 1); continue; }
      c.dx = DIRS[c.d][0]; c.dy = DIRS[c.d][1];
      const off = c.off;
      c.px = c.tx + 0.5 + c.dx * (c.t - 0.5) + -c.dy * off;
      c.py = c.ty + 0.5 + c.dy * (c.t - 0.5) + c.dx * off;
    }
  }
}

export class Traffic extends Mover {
  constructor(world, rnd) { super(world, rnd); this.needBuilt = false; this.flow = null; }
  spawn(needBuilt) {
    const f = this.flow;
    if (f && f.total > 0) for (let t = 0; t < 8; t++) {
      const q = f.pick(this.rnd()); if (q < 0) break; const x = q % N, y = (q / N) | 0;
      const od = this.openDirs(x, y, -1); if (!od.length) continue;
      const c = this.make(x, y, od[Math.floor(this.rnd() * od.length)]); c.life = 10 + Math.floor(this.rnd() * 14); return c;
    }
    return super.spawn(needBuilt);
  }
  get cars() { return this.list; }
  make(x, y, d) { return { tx: x, ty: y, d, t: this.rnd() * 0.8, speed: 0.9 + this.rnd() * 0.7, col: Math.floor(this.rnd() * 8), px: 0, py: 0, dx: DIRS[d][0], dy: DIRS[d][1], off: 0.13 }; }
  update(dt, target, sigT) { this.sigT = sigT; this.flowW = this.flow && this.flow.total > 0 ? this.flow.flow : null; this.balance(dt, target, 0.35); this.step(dt, 0); }
}

export class Walkers extends Mover {
  constructor(world, rnd) { super(world, rnd); this.needBuilt = true; }
  get people() { return this.list; }
  make(x, y, d) { return { ped: true, tx: x, ty: y, d, t: this.rnd(), speed: 0.28 + this.rnd() * 0.18, col: Math.floor(this.rnd() * 8), px: 0, py: 0, dx: DIRS[d][0], dy: DIRS[d][1], off: (this.rnd() < 0.5 ? -1 : 1) * 0.43 }; }
  update(dt, target) { this.balance(dt, target, 0.3); this.step(dt, 0.25); }
}

export class Trucks extends Mover {
  constructor(world, rnd, getFacilities) { super(world, rnd); this.needBuilt = false; this.getFac = getFacilities; }
  get trucks() { return this.list; }
  make(x, y, d) { return { truck: true, tx: x, ty: y, d, t: this.rnd() * 0.8, speed: 0.6 + this.rnd() * 0.3, col: 8, px: 0, py: 0, dx: DIRS[d][0], dy: DIRS[d][1], off: 0.13 }; }
  spawn() {
    const fac = this.getFac();
    if (fac.length) {
      const f = fac[Math.floor(this.rnd() * fac.length)];
      for (let t = 0; t < 40; t++) {
        const x = f.x + Math.floor(this.rnd() * (f.def.w + 8)) - 4, y = f.y + Math.floor(this.rnd() * (f.def.d + 8)) - 4;
        if (!this.w.inb(x, y) || !this.w.isRoad(x, y)) continue;
        const od = this.openDirs(x, y, -1); if (!od.length) continue;
        return this.make(x, y, od[Math.floor(this.rnd() * od.length)]);
      }
    }
    return super.spawn(false);
  }
  // A lorry that drives a transfer station's route: from the station to the waste building and back, a few times, then
  // another one takes over. Busier routes get more lorries.
  haul(routes) {
    let sum = 0; for (const r of routes) sum += r.amt;
    let pick = this.rnd() * sum, r = routes[0]; for (const q of routes) { pick -= q.amt; if (pick <= 0) { r = q; break; } }
    const p = r.path, fwd = this.rnd() < 0.5, i0 = fwd ? 0 : p.length - 1, dir = fwd ? 1 : -1, a = p[i0], b = p[i0 + dir];
    const x = a % N, y = (a / N) | 0, d = DIRS.findIndex((v) => v[0] === (b % N) - x && v[1] === ((b / N) | 0) - y);
    if (d < 0 || !this.w.isRoad(x, y)) return null;
    const c = this.make(x, y, d); c.path = p; c.pi = i0; c.dir = dir; c.t = this.rnd() * 0.5;   // heading for tile b; follow() takes over there
    return c;
  }
  update(dt, target, sigT, routes, ver) {
    this.sigT = sigT;
    if (ver !== this.ver) { this.ver = ver; this.list = this.list.filter((c) => !c.path); }   // the routes changed: their lorries go
    const nh = this.list.reduce((a, c) => a + (c.path ? 1 : 0), 0), want = routes && routes.length ? Math.min(8, routes.length * 2) : 0;
    this.hTimer = (this.hTimer || 0) + dt;
    if (this.hTimer > 0.7) { this.hTimer = 0; if (nh < want) { const c = this.haul(routes); if (c) this.list.push(c); } }
    // wandering collection lorries around the waste buildings, as before (the route lorries don't count towards them)
    this.timer += dt;
    if (this.timer >= 0.8) {
      this.timer = 0; const nw = this.list.length - nh;
      if (nw < target) { const m = this.spawn(); if (m) this.list.push(m); }
      else if (nw > target) { const j = this.list.findIndex((c) => !c.path); if (j >= 0) this.list.splice(j, 1); }
    }
    this.step(dt, 0);
  }
}
