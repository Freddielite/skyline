import { N } from './world.js';
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

class Mover {
  constructor(world, rnd) { this.w = world; this.rnd = rnd; this.list = []; this.timer = 0; }
  openDirs(x, y, not) {
    const out = [];
    for (let d = 0; d < 4; d++) if (d !== not && this.w.isRoad(x + DIRS[d][0], y + DIRS[d][1])) out.push(d);
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
      c.t += dt * c.speed;
      while (c.t >= 1) {
        c.t -= 1;
        c.tx += DIRS[c.d][0]; c.ty += DIRS[c.d][1];
        if (!this.w.isRoad(c.tx, c.ty)) { c.dead = true; break; }
        const back = (c.d + 2) % 4;
        let od = this.openDirs(c.tx, c.ty, back);
        if (!od.length) od = [back];
        else if (turnBack && this.rnd() < turnBack) od.push(back);
        const straight = od.includes(c.d) && this.rnd() < 0.65;
        c.d = straight ? c.d : od[Math.floor(this.rnd() * od.length)];
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
  constructor(world, rnd) { super(world, rnd); this.needBuilt = false; }
  get cars() { return this.list; }
  make(x, y, d) { return { tx: x, ty: y, d, t: this.rnd() * 0.8, speed: 0.9 + this.rnd() * 0.7, col: Math.floor(this.rnd() * 8), px: 0, py: 0, dx: DIRS[d][0], dy: DIRS[d][1], off: 0.13 }; }
  update(dt, target) { this.balance(dt, target, 0.35); this.step(dt, 0); }
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
  update(dt, target) { this.balance(dt, target, 0.8); this.step(dt, 0); }
}
