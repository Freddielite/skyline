// Disasters: fires (fought by fire stations and trucks), tornadoes and UFO raids.
import { N, T } from './world.js';
import { BT } from './buildings.js';

const ZONE = new Set([T.RES, T.COM, T.IND]);
export const LEVELS = [0, 1, 2.5, 5];         // Off, Rare, Normal, Chaos
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];

export class Disasters {
  constructor(game) {
    this.g = game;
    this.fires = new Map(); this.rubble = new Map(); this.responders = [];
    this.tornado = null; this.ufo = null; this.clock = 0; this.acc = 0; this.alert = '';
    this.stats = { destroyed: 0, damaged: 0 };
  }
  get w() { return this.g.world; }
  get sim() { return this.g.sim; }
  say(m) { this.alert = m; this.g.hooks.toast && this.g.hooks.toast(m); }

  anchor(i) { const w = this.w; if (w.kind[i] !== T.SVC) return i; const x = i % N, y = (i / N) | 0; return (y - (w.bo[i] >> 2)) * N + (x - (w.bo[i] & 3)); }
  built(i) {
    const w = this.w, k = w.kind[i];
    if (ZONE.has(k)) return this.sim.lvl(i) > 0 && !this.sim.pending.has(i);
    if (k === T.SVC) return !this.sim.pending.has(this.anchor(i));
    return false;
  }
  pickBuilt(cx, cy, r) {
    const out = [], x0 = cx === undefined ? 0 : Math.max(0, Math.floor(cx - r)), x1 = cx === undefined ? N - 1 : Math.min(N - 1, Math.ceil(cx + r));
    const y0 = cy === undefined ? 0 : Math.max(0, Math.floor(cy - r)), y1 = cy === undefined ? N - 1 : Math.min(N - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if (this.built(i)) out.push(i); }
    return out.length ? out[Math.floor(Math.random() * out.length)] : -1;
  }

  // ---- damage ----
  hit(i, mode) {
    const w = this.w, sim = this.sim, g = this.g, k = w.kind[i];
    const rub = (q) => { this.rubble.set(q, 28); this.fires.delete(q); w.tree[q] = 0; };
    if (k === T.SVC) {
      const a = this.anchor(i), def = BT[w.bt[a]], ax = a % N, ay = (a / N) | 0;
      sim.pending.delete(a); g.sites.delete(a); this.stats.destroyed++;
      for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) { const q = (ay + dy) * N + ax + dx; w.kind[q] = T.EMPTY; w.bt[q] = 0; w.bo[q] = 0; rub(q); }
    } else if (ZONE.has(k)) {
      sim.pending.delete(i); g.sites.delete(i);
      const l = sim.lvl(i); w.level[i] = mode === 'destroy' || l <= 1 ? 0 : l - 1; rub(i);
      if (w.level[i] === 0) this.stats.destroyed++; else this.stats.damaged++;
    } else return;
    sim.needAn = true; sim.recount();
  }

  // ---- fire ----
  stations() {
    const w = this.w, out = [];
    for (let i = 0; i < N * N; i++) if (w.kind[i] === T.SVC && w.bo[i] === 0 && (w.bt[i] === 5 || w.bt[i] === 9) && !this.sim.pending.has(i)) { const d = BT[w.bt[i]]; out.push({ x: i % N, y: (i / N) | 0, w: d.w, d: d.d, i }); }
    return out;
  }
  ignite(i, spread) {
    if (this.fires.has(i)) return;
    this.fires.set(i, { i, age: 0, dmg: 0, dous: false, ph: Math.random() * 6 });
    if (!spread) this.say('Fire!');
    const x = i % N, y = (i / N) | 0, st = this.stations();
    if (!st.length || this.responders.filter((r) => r.target === i).length) return;
    let best = null, bd = 1e9;
    for (const s of st) { const d = Math.abs(s.x - x) + Math.abs(s.y - y); if (d < bd) { bd = d; best = s; } }
    const pts = this.g.agents.route(best, { x, y, w: 1, d: 1 });
    if (!pts) return;
    this.responders.push({ truck: true, fire: true, target: i, pts, back: false, seg: 0, t: 0, speed: 3.2, wait: 0, px: pts[0][0], py: pts[0][1], dx: 1, dy: 0, col: 9 });
  }
  fireStep() {
    const sim = this.sim, cov = sim.cov.fire, fp = sim.ord.fireproof ? 0.6 : 1;
    for (const f of [...this.fires.values()]) {
      f.age++; f.dmg += f.dous ? 0.4 : 1;
      const x = f.i % N, y = (f.i / N) | 0, fc = cov[f.i];
      if (!f.dous) for (const [dx, dy] of NB) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = yy * N + xx; if (this.built(j) && !this.fires.has(j) && Math.random() < 0.012 * fp * (1 - 0.8 * fc)) this.ignite(j, true);
      }
      if (!this.built(f.i)) { this.fires.delete(f.i); continue; }
      const p = f.dous ? 0.55 : 0.04 + 0.3 * fc;
      if (Math.random() < p || f.age >= 26) {
        this.fires.delete(f.i);
        if (f.dmg >= 14 || f.age >= 26) this.hit(f.i, 'destroy'); else if (f.dmg >= 5) this.hit(f.i, 'damage');
      }
    }
  }
  moveResponders(dt) {
    for (let k = this.responders.length - 1; k >= 0; k--) {
      const r = this.responders[k];
      if (r.wait > 0) { r.wait -= dt; if (r.wait <= 0) { r.pts = r.pts.slice().reverse(); r.seg = 0; r.t = 0; r.back = true; } continue; }
      let dist = r.speed * dt, p = r.pts;
      while (dist > 0) {
        const A = p[r.seg], B = p[r.seg + 1], len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 0.001, left = (1 - r.t) * len;
        if (dist < left) { r.t += dist / len; dist = 0; } else { dist -= left; r.seg++; r.t = 0; if (r.seg >= p.length - 1) { dist = -1; break; } }
      }
      if (dist === -1) {
        if (r.back) { this.responders.splice(k, 1); continue; }
        const f = this.fires.get(r.target); if (f) f.dous = true; r.wait = 7; r.seg = p.length - 2; r.t = 1; continue;
      }
      const A = p[r.seg], B = p[r.seg + 1], ax = B[0] - A[0], ay = B[1] - A[1];
      if (Math.abs(ax) >= Math.abs(ay)) { r.dx = Math.sign(ax) || 1; r.dy = 0; } else { r.dx = 0; r.dy = Math.sign(ay) || 1; }
      const edge = r.seg === 0 || r.seg === p.length - 2, off = edge ? 0 : 0.13;
      r.px = A[0] + ax * r.t - r.dy * off; r.py = A[1] + ay * r.t + r.dx * off;
    }
  }

  // ---- tornado ----
  spawnTornado() {
    if (this.tornado) return;
    const side = Math.floor(Math.random() * 4), u = 8 + Math.random() * (N - 16);
    const x = side === 0 ? -3 : side === 1 ? N + 3 : u, y = side === 2 ? -3 : side === 3 ? N + 3 : u;
    const tx = 12 + Math.random() * (N - 24), ty = 12 + Math.random() * (N - 24), d = Math.hypot(tx - x, ty - y) || 1;
    this.tornado = { x, y, vx: ((tx - x) / d) * 2.1, vy: ((ty - y) / d) * 2.1, t: 0, tick: 0, wob: Math.random() * 6 };
    this.say('Tornado warning!');
  }
  updateTornado(dt) {
    const t = this.tornado; if (!t) return;
    t.t += dt; t.wob += dt * 0.7; t.x += (t.vx + Math.cos(t.wob) * 0.9) * dt; t.y += (t.vy + Math.sin(t.wob * 1.3) * 0.9) * dt; t.tick += dt;
    if (t.tick > 0.45) {
      t.tick = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = Math.round(t.x) + dx, y = Math.round(t.y) + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const i = y * N + x; this.w.tree[i] = 0;
        if (this.built(i) && Math.random() < 0.55) this.hit(i, 'destroy');
      }
    }
    if (t.t > 60 || t.x < -8 || t.y < -8 || t.x > N + 8 || t.y > N + 8) this.tornado = null;
  }

  // ---- UFO ----
  spawnUfo() {
    if (this.ufo) return;
    const c = this.pickBuilt(); if (c < 0) return;
    const tx = c % N, ty = (c / N) | 0;
    this.ufo = { x: tx - 14, y: ty - 14, tx, ty, st: 'in', shots: 0, max: 4 + Math.floor(Math.random() * 3), timer: 0, beam: null, h: 70, spin: 0 };
    this.say('UFO sighted!');
  }
  updateUfo(dt) {
    const u = this.ufo; if (!u) return; u.spin += dt;
    if (u.st === 'in') {
      const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy);
      const step = 4.5 * dt;
      if (d <= Math.max(0.4, step)) { u.x = u.tx; u.y = u.ty; u.st = 'hover'; u.timer = 0; } else { u.x += (dx / d) * step; u.y += (dy / d) * step; u.h = Math.max(46, u.h - 12 * dt); }
    } else if (u.st === 'hover') {
      u.timer += dt;
      if (!u.beam && u.timer > 2) { const i = this.pickBuilt(u.x, u.y, 4); if (i >= 0) { u.beam = { i, t: 0 }; } u.timer = 0; }
      if (u.beam) { u.beam.t += dt; if (u.beam.t > 1.3) { if (this.built(u.beam.i)) this.hit(u.beam.i, 'destroy'); u.beam = null; u.shots++; u.timer = 0; if (u.shots >= u.max) u.st = 'leave'; } }
      if (!u.beam && u.timer > 6 && u.shots === 0) u.st = 'leave';
    } else { u.x += 5 * dt; u.y -= 5 * dt; u.h += 20 * dt; if (u.h > 160 || u.x > N + 20) this.ufo = null; }
  }

  trigger(kind) {
    if (kind === 'fire') { const i = this.pickBuilt(); if (i < 0) { this.g.hooks.toast && this.g.hooks.toast('Nothing to burn yet'); return; } this.ignite(i); }
    else if (kind === 'tornado') this.spawnTornado();
    else if (kind === 'ufo') { this.spawnUfo(); if (!this.ufo) this.g.hooks.toast && this.g.hooks.toast('Nothing for aliens to visit yet'); }
  }

  update(dt) {
    for (const [i, t] of this.rubble) { if (t - dt <= 0) this.rubble.delete(i); else this.rubble.set(i, t - dt); }
    if (dt <= 0) return;
    this.clock += dt;
    this.moveResponders(dt); this.updateTornado(dt); this.updateUfo(dt);
    this.acc += dt;
    while (this.acc >= 1) {
      this.acc -= 1; this.fireStep();
      const L = LEVELS[this.sim.disasters] || 0;
      if (L > 0 && this.sim.pop >= 120) {
        const fp = this.sim.ord.fireproof ? 0.6 : 1;
        if (Math.random() < (L * fp) / 130) { const i = this.pickBuilt(); if (i >= 0) this.ignite(i); }
        if (Math.random() < L / 800) this.spawnTornado();
        if (Math.random() < L / 1200) this.spawnUfo();
      }
    }
  }
}
