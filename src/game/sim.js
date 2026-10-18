import { T, N, TERRAIN } from './world.js';
import { clamp, mulberry32, hash } from './util.js';
import { BT, BY_KEY, ELEC, WATER, WASTE } from './buildings.js';

export const COST = { road: 10, zone: 5, park: 25, bulldoze: 2, wire: 4, cable: 12 };
export const POP_CAP = [0, 8, 24, 70];
export const COM_CAP = [0, 5, 14, 40];
export const IND_CAP = [0, 8, 18, 42];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ZK = { [T.RES]: 'r', [T.COM]: 'c', [T.IND]: 'i' };
const COVS = ['police', 'fire', 'health', 'edu', 'fun'];

export class Sim {
  constructor(world, state) {
    this.w = world;
    this.rnd = mulberry32((world.seed * 7919) ^ 0x9e3779b9);
    const s = state || {};
    this.money = s.money ?? 20000;
    this.day = s.day ?? 0;
    this.tax = s.tax ?? { r: 9, c: 9, i: 9 };
    this.lastIncome = s.lastIncome ?? 0;
    this.lastExpense = s.lastExpense ?? 0;
    this.events = [];
    this.grace = this.day + 90;         // older saves get time to wire up before buildings decay
    const n = N * N;
    this.pw = new Uint8Array(n); this.wt = new Uint8Array(n); this.ts = new Uint8Array(n);
    this.lv = new Float32Array(n); this.indPen = new Float32Array(n);
    this.crime = new Float32Array(n); this.poll = new Float32Array(n);
    this.cov = {}; for (const k of COVS) this.cov[k] = new Float32Array(n);
    this.powerMap = new Uint8Array(n); this.waterMap = new Uint8Array(n); this.wasteMap = new Uint8Array(n);
    this.facilities = [];
    this.pending = new Map();          // tile -> { from } while a building is still under construction
    this.defer = false;                // set by the game: new buildings only count once finished
    this.net = { pSup: 0, pDem: 0, wSup: 0, wDem: 0, tSup: 0, tDem: 0, unserved: 0, wasteUn: 0, upkeep: 0, crimeAvg: 0, pollAvg: 0, police: 0, fire: 0, health: 0, edu: 0, fun: 0, stadiums: 0 };
    this.recount();
    this.analyze();
  }
  lvl(i) { const p = this.pending.get(i); return p ? p.from : this.w.level[i]; }     // level that currently counts
  markBuilt(i, ev) { this.events.push({ type: 'built', i, ...ev }); if (this.defer) this.pending.set(i, { from: ev.from }); }
  finish(i) { if (this.pending.delete(i)) { this.needAn = true; this.recount(); } }
  get year() { return 2026 + Math.floor(this.day / 360); }
  get month() { return Math.floor((this.day % 360) / 30); }
  get dom() { return (this.day % 30) + 1; }
  dateLabel() { return `${this.dom} ${MONTHS[this.month]} ${this.year}`; }
  state() { return { money: this.money, day: this.day, tax: this.tax, lastIncome: this.lastIncome, lastExpense: this.lastExpense }; }

  recount() {
    const w = this.w;
    let pop = 0, cj = 0, ij = 0, roads = 0, parks = 0, rb = 0, cb = 0, ib = 0;
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i], l = this.lvl(i);
      if (k === T.ROAD) roads++;
      else if (k === T.PARK) { if (!this.pending.has(i)) parks++; }
      else if (k === T.RES && l) { pop += POP_CAP[l]; rb++; }
      else if (k === T.COM && l) { cj += COM_CAP[l]; cb++; }
      else if (k === T.IND && l) { ij += IND_CAP[l]; ib++; }
    }
    this.pop = pop; this.cJobs = cj; this.iJobs = ij; this.roads = roads; this.parks = parks;
    this.bld = { r: rb, c: cb, i: ib };
    const jobs = cj + ij;
    const tm = (t) => -(t - 9) * 0.04 + 0.14;
    const stad = Math.min(3, this.net.stadiums) * 0.06;
    this.rd = clamp((jobs - pop * 0.85 + 18) / (40 + jobs * 0.25) + tm(this.tax.r), -1, 1);
    this.cd = clamp((pop * 0.3 - cj + 4) / (30 + cj * 0.2) + tm(this.tax.c) + stad, -1, 1);
    this.id = clamp((pop * 0.4 - ij + 6) / (30 + ij * 0.2) + tm(this.tax.i), -1, 1);
    this.updateHappiness();
  }
  updateHappiness() {
    const n = this.net, avgTax = (this.tax.r + this.tax.c + this.tax.i) / 3;
    const parkBonus = Math.min(18, (this.parks * 400) / (this.pop + 100));
    let h = 58 - (avgTax - 9) * 3.2 + parkBonus - Math.max(0, -this.rd) * 12;
    h += n.police * 7 + n.health * 7 + n.edu * 6 + n.fire * 3 + n.fun * 8 - n.crimeAvg * 0.18 - n.pollAvg * 0.16 - n.unserved * 30 - n.wasteUn * 18;
    this.happiness = clamp(Math.round(h), 0, 100);
  }

  // ---- networks, coverage and value maps ----
  analyze() {
    const w = this.w, n = N * N;
    // wire networks (overhead lines and underground cable connect to each other)
    const comp = new Int32Array(n).fill(-1), par = [];
    let nc = 0; const stack = [];
    for (let s = 0; s < n; s++) {
      if (!w.wire[s] || comp[s] >= 0) continue;
      comp[s] = nc; par.push(nc); stack.push(s);
      while (stack.length) {
        const c = stack.pop(), x = c % N, y = (c / N) | 0;
        for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (!w.inb(xx, yy)) continue; const q = yy * N + xx; if (w.wire[q] && comp[q] < 0) { comp[q] = nc; stack.push(q); } }
      }
      nc++;
    }
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
    const ring = (x0, y0, fw, fd, r, fn) => { for (let y = y0 - r; y < y0 + fd + r; y++) for (let x = x0 - r; x < x0 + fw + r; x++) if (w.inb(x, y)) fn(comp[y * N + x]); };

    const anchors = [], zones = [], empties = [];
    for (let i = 0; i < n; i++) {
      const k = w.kind[i], x = i % N, y = (i / N) | 0;
      if (k === T.SVC && w.bo[i] === 0) { if (!this.pending.has(i)) anchors.push({ x, y, i, def: BT[w.bt[i]] }); }
      else if (ZK[k] && this.lvl(i)) zones.push({ x, y, i, z: ZK[k], l: this.lvl(i) });
      else if (ZK[k]) empties.push({ x, y, i });
    }
    this.facilities = anchors.filter((a) => a.def.waste);

    // power: generators must touch a line; buildings pick up power from lines within 2 tiles
    const plants = anchors.filter((a) => a.def.power);
    for (const a of plants) { let first = -1; ring(a.x, a.y, a.def.w, a.def.d, 1, (c) => { if (c >= 0) { if (first < 0) first = c; else union(first, c); } }); a.comp = first; }
    const out = new Map(), dem = new Map();
    let pSup = 0, pDem = 0;
    for (const a of plants) { pSup += a.def.power; if (a.comp >= 0) { const r = find(a.comp); out.set(r, (out.get(r) || 0) + a.def.power); } }
    const consumers = [];
    for (const z of zones) consumers.push({ i: z.i, x: z.x, y: z.y, fw: 1, fd: 1, p: ELEC[z.z][z.l], wa: WATER[z.z][z.l], ws: WASTE[z.z][z.l], zone: true });
    for (const a of anchors) if (!a.def.power && a.def.use) consumers.push({ i: a.i, x: a.x, y: a.y, fw: a.def.w, fd: a.def.d, p: a.def.use, wa: 2, ws: 0 });
    for (const c of consumers) {
      let root = -1; ring(c.x, c.y, c.fw, c.fd, 2, (cc) => { if (root < 0 && cc >= 0) root = find(cc); });
      c.root = root; pDem += c.p;
      if (root >= 0) dem.set(root, (dem.get(root) || 0) + c.p);
    }
    this.pw.fill(0); this.powerMap.fill(0);
    let unpowered = 0;
    for (const c of consumers) {
      const o = c.root >= 0 ? out.get(c.root) || 0 : 0, d = dem.get(c.root) || 1, ratio = Math.min(1, o / d);
      const ok = c.root >= 0 && o > 0 && hash(c.x, c.y, 1) < ratio + 1e-6;
      this.pw[c.i] = ok ? 1 : 0; this.powerMap[c.i] = ok ? 1 : 2; if (!ok) unpowered++;
    }
    for (const a of anchors) if (a.def.use === undefined && !a.def.power) this.pw[a.i] = 1; // passive amenities
    for (const e of empties) {
      let root = -1; ring(e.x, e.y, 1, 1, 2, (cc) => { if (root < 0 && cc >= 0) root = find(cc); });
      const o = root >= 0 ? out.get(root) || 0 : 0, d = dem.get(root) || 0;
      this.pw[e.i] = o > 0 && o >= d * 0.95 ? 1 : 0;
    }
    for (let i = 0; i < n; i++) if (comp[i] >= 0) this.powerMap[i] = (out.get(find(comp[i])) || 0) > 0 ? 3 : 4;
    for (let i = 0; i < n; i++) if (w.kind[i] === T.ROAD && !w.wire[i]) {   // street lamps work near live lines
      const x = i % N, y = (i / N) | 0; let live = false;
      ring(x, y, 1, 1, 2, (c) => { if (!live && c >= 0 && (out.get(find(c)) || 0) > 0) live = true; });
      if (live) this.powerMap[i] = 3;
    }

    // water: towers serve consumers inside their radius, up to capacity
    const towers = anchors.filter((a) => a.def.water);
    const load = towers.map(() => 0);
    this.waterMap.fill(0);
    for (const t of towers) {
      const cx = t.x + t.def.w / 2, cy = t.y + t.def.d / 2, R = t.def.radius;
      for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R) this.waterMap[y * N + x] = 1;
      }
    }
    let wDem = 0, wSup = 0; for (const t of towers) wSup += t.def.water;
    for (const c of consumers) {
      wDem += c.wa; let best = -1, bd = 1e9;
      towers.forEach((t, ti) => { const d = Math.hypot(c.x + c.fw / 2 - (t.x + t.def.w / 2), c.y + c.fd / 2 - (t.y + t.def.d / 2)); if (d <= t.def.radius && d < bd) { bd = d; best = ti; } });
      c.tower = best; if (best >= 0) load[best] += c.wa;
    }
    this.wt.fill(0);
    for (const c of consumers) {
      if (c.tower < 0) { this.waterMap[c.i] = 2; continue; }
      const ratio = Math.min(1, towers[c.tower].def.water / Math.max(1, load[c.tower]));
      const ok = hash(c.x, c.y, 2) < ratio + 1e-6;
      this.wt[c.i] = ok ? 1 : 0; this.waterMap[c.i] = ok ? 3 : 2;
    }

    // waste: facilities collect from buildings in range, up to capacity (recycling needs power)
    const fac = this.facilities, fcap = fac.map((f) => f.def.waste * (!f.def.use || this.pw[f.i] ? 1 : 0.3)), fload = fac.map(() => 0);
    this.wasteMap.fill(0); this.ts.fill(0);
    for (const f of fac) {
      const cx = f.x + f.def.w / 2, cy = f.y + f.def.d / 2, R = f.def.radius;
      for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R) this.wasteMap[y * N + x] = 1;
      }
    }
    let tDem = 0, tSup = 0, wUn = 0, zc = 0; for (const f of fac) tSup += f.def.waste;
    const zc2 = consumers.filter((c) => c.zone);
    for (const c of zc2) {
      tDem += c.ws; let best = -1, bd = 1e9;
      fac.forEach((f, fi) => { const d = Math.hypot(c.x + 0.5 - (f.x + f.def.w / 2), c.y + 0.5 - (f.y + f.def.d / 2)); if (d <= f.def.radius && d < bd) { bd = d; best = fi; } });
      c.fac = best; if (best >= 0) fload[best] += c.ws;
    }
    for (const c of zc2) {
      zc++;
      if (c.fac < 0) { this.wasteMap[c.i] = 2; wUn++; continue; }
      const ratio = Math.min(1, fcap[c.fac] / Math.max(1, fload[c.fac]));
      const ok = hash(c.x, c.y, 3) < ratio + 1e-6;
      this.ts[c.i] = ok ? 1 : 0; this.wasteMap[c.i] = ok ? 3 : 2; if (!ok) wUn++;
    }

    // service and amenity coverage
    for (const k of COVS) this.cov[k].fill(0);
    let upkeep = 0, stadiums = 0;
    for (const a of anchors) {
      upkeep += a.def.upkeep;
      if (a.def.key === 'stadium') stadiums++;
      if (!a.def.cov) continue;
      const eff = a.def.use === undefined || this.pw[a.i] ? 1 : 0.3, R = a.def.radius, cx = a.x + a.def.w / 2, cy = a.y + a.def.d / 2;
      for (const [key, str] of a.def.cov) {
        const arr = this.cov[key];
        for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d >= R) continue;
          const v = Math.min(1, (1 - d / R) * 1.6 * str) * eff, q = y * N + x; if (v > arr[q]) arr[q] = v;
        }
      }
    }
    // pollution, density, crime, land value
    const poll = this.poll, dens = new Float32Array(n), parkAcc = new Float32Array(n), ind = this.indPen;
    poll.fill(0); ind.fill(0);
    const spread = (x0, y0, R, fn) => { for (let y = Math.max(0, y0 - R); y <= Math.min(N - 1, y0 + R); y++) for (let x = Math.max(0, x0 - R); x <= Math.min(N - 1, x0 + R); x++) { const d = Math.hypot(x - x0, y - y0); if (d <= R) fn(y * N + x, 1 - d / (R + 0.001)); } };
    for (let i = 0; i < n; i++) {
      const k = w.kind[i], x = i % N, y = (i / N) | 0, l = this.lvl(i);
      if (k === T.IND && l) { spread(x, y, 4, (q, f) => { poll[q] += l * 7 * f; }); spread(x, y, 4, (q) => { ind[q] += 6; }); }
      else if (k === T.PARK && !this.pending.has(i)) { spread(x, y, 5, (q) => { parkAcc[q] += 8; }); spread(x, y, 3, (q, f) => { poll[q] -= 8 * f; }); }
      else if ((k === T.RES || k === T.COM) && l) spread(x, y, 3, (q, f) => { dens[q] += (k === T.RES ? POP_CAP[l] : COM_CAP[l] * 0.5) * f * 0.25; });
      if (ZK[k] && l && !this.ts[i]) spread(x, y, 2, (q, f) => { poll[q] += l * 3 * f; });   // uncollected garbage
    }
    for (const a of anchors) if (a.def.pollute) spread(a.x, a.y, a.def.pr || 6, (q, f) => { poll[q] += a.def.pollute * f; });
    let pv = 0, polSum = 0, crSum = 0; const covS = {}; for (const k of COVS) covS[k] = 0;
    for (let i = 0; i < n; i++) {
      poll[i] = clamp(poll[i], 0, 100);
      this.crime[i] = clamp(10 + dens[i] * 0.5 + poll[i] * 0.12 - this.cov.police[i] * 55, 0, 100);
      const x = i % N, y = (i / N) | 0;
      let v = 40 + Math.min(24, parkAcc[i]) + (w.roadNear(x, y, 1) ? 8 : 0);
      v += this.cov.police[i] * 5 + this.cov.health[i] * 6 + this.cov.edu[i] * 6 + this.cov.fire[i] * 4 + this.cov.fun[i] * 6 - poll[i] * 0.28 - this.crime[i] * 0.12;
      this.lv[i] = clamp(v, 0, 100);
      if (w.kind[i] === T.RES && this.lvl(i)) { const wgt = POP_CAP[this.lvl(i)]; pv += wgt; polSum += poll[i] * wgt; crSum += this.crime[i] * wgt; for (const k of COVS) covS[k] += this.cov[k][i] * wgt; }
    }
    const pvv = Math.max(1, pv);
    Object.assign(this.net, { pSup, pDem, wSup, wDem, tSup, tDem, unserved: consumers.length ? unpowered / consumers.length : 0, wasteUn: zc ? wUn / zc : 0, upkeep, stadiums, crimeAvg: pv ? crSum / pvv : 0, pollAvg: pv ? polSum / pvv : 0, police: covS.police / pvv, fire: covS.fire / pvv, health: covS.health / pvv, edu: covS.edu / pvv, fun: covS.fun / pvv });
    this.needAn = false;
    this.updateHappiness();
  }

  landValue(i, z) { return this.lv[i] - (z === T.RES ? Math.min(24, this.indPen[i]) : 0); }

  tick() {
    this.day++;
    if (this.needAn || this.day % 8 === 0) this.analyze();
    const w = this.w, rnd = this.rnd;
    for (let n = 0; n < 150; n++) {
      const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N), i = w.idx(x, y);
      const z = w.kind[i];
      if (z !== T.RES && z !== T.COM && z !== T.IND) continue;
      if (this.pending.has(i)) continue;
      const d = z === T.RES ? this.rd : z === T.COM ? this.cd : this.id;
      const lvl = w.level[i];
      const road = w.roadNear(x, y, 2);
      if (!road) { if (lvl && rnd() < 0.03) w.level[i] = lvl - 1; continue; }
      const pw = this.pw[i], wt = this.wt[i];
      if (lvl === 0) {
        if (pw && d > -0.05 && rnd() < 0.15 + 0.5 * Math.max(0, d)) { const pv = w.variant[i]; w.level[i] = 1; w.variant[i] = Math.floor(rnd() * 4); this.needAn = true; this.markBuilt(i, { kind: z, from: 0, to: 1, pv }); }
        continue;
      }
      if (!pw && this.day > this.grace && rnd() < 0.02) { w.level[i] = lvl - 1; this.needAn = true; continue; }
      if (lvl < 3) {
        const need = lvl === 1 ? 46 : 62;
        const ok = pw && wt && (lvl === 1 || this.ts[i]);
        if (ok && d > 0.04 && this.landValue(i, z) >= need && rnd() < 0.1 * d + 0.02) { const pv = w.variant[i]; w.level[i] = lvl + 1; w.variant[i] = Math.floor(rnd() * 4); this.needAn = true; this.markBuilt(i, { kind: z, from: lvl, to: lvl + 1, pv }); }
        else if (d < -0.25 && rnd() < 0.06) { w.level[i] = lvl - 1; this.needAn = true; }
      } else if (d < -0.25 && rnd() < 0.06) { w.level[i] = 2; this.needAn = true; }
      if (lvl === 1 && d < -0.35 && rnd() < 0.05) { w.level[i] = 0; this.needAn = true; }
    }
    this.recount();
    if (this.day % 30 === 0) this.monthly();
  }

  monthly() {
    const served = 0.5 + 0.5 * (1 - this.net.unserved);
    const inc = (this.pop * (this.tax.r / 100) * 14 + this.cJobs * (this.tax.c / 100) * 16 + this.iJobs * (this.tax.i / 100) * 16) * served;
    let wires = 0; for (let i = 0; i < N * N; i++) if (this.w.wire[i]) wires += this.w.wire[i] === 2 ? 0.4 : 0.2;
    const exp = this.roads * 0.6 + this.parks * 1.5 + this.net.upkeep + wires;
    this.lastIncome = Math.round(inc); this.lastExpense = Math.round(exp);
    this.money += this.lastIncome - this.lastExpense;
    this.events.push({ type: 'month', income: this.lastIncome, expense: this.lastExpense });
  }

  // ---- player actions ----
  spend(c) { if (this.money < c) return false; this.money -= c; return true; }
  canPlaceBuilding(key, x, y) {
    const def = BY_KEY[key], w = this.w;
    for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) {
      const xx = x + dx, yy = y + dy;
      if (!w.inb(xx, yy)) return { ok: false, why: 'Out of bounds' };
      const i = w.idx(xx, yy), k = w.kind[i];
      if (w.terrain[i] === TERRAIN.WATER) return { ok: false, why: 'Can\u2019t build on water' };
      if (!(k === T.EMPTY || (ZK[k] && w.level[i] === 0))) return { ok: false, why: 'Tiles must be clear' };
    }
    return { ok: true };
  }
  placeBuilding(key, x, y) {
    const def = BY_KEY[key], w = this.w, c = this.canPlaceBuilding(key, x, y);
    if (!c.ok) return c;
    if (!this.spend(def.cost)) return { ok: false, why: 'Not enough money' };
    for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) {
      const i = w.idx(x + dx, y + dy);
      w.kind[i] = T.SVC; w.bt[i] = def.id; w.bo[i] = dx | (dy << 2); w.level[i] = 0; w.tree[i] = 0;
      if (w.wire[i] === 1) w.wire[i] = 0;      // overhead lines are cleared, buried cable stays
    }
    this.markBuilt(w.idx(x, y), { bt: def.id, from: 0, to: 1 });
    this.recount(); this.analyze();
    return { ok: true, cost: def.cost };
  }
  place(tool, x, y) {
    const w = this.w;
    if (!w.buildable(x, y)) return { ok: false, why: 'Can\u2019t build on water' };
    const i = w.idx(x, y), k = w.kind[i];
    if (tool === 'bulldoze') {
      if (k === T.SVC) {
        const def = BT[w.bt[i]], ax = x - (w.bo[i] & 3), ay = y - (w.bo[i] >> 2), cost = COST.bulldoze * 5;
        if (!this.spend(cost)) return { ok: false, why: 'Not enough money' };
        this.pending.delete(w.idx(ax, ay));
        for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) { const q = w.idx(ax + dx, ay + dy); w.kind[q] = T.EMPTY; w.bt[q] = 0; w.bo[q] = 0; }
        this.needAn = true; this.recount(); return { ok: true, cost };
      }
      if (k !== T.EMPTY) {
        if (!this.spend(COST.bulldoze)) return { ok: false, why: 'Not enough money' };
        this.pending.delete(i);
        w.kind[i] = T.EMPTY; w.level[i] = 0; w.tree[i] = 0; this.needAn = true; this.recount(); return { ok: true, cost: COST.bulldoze };
      }
      if (w.tree[i]) { w.tree[i] = 0; return { ok: true, cost: 0 }; }
      if (w.wire[i]) { if (!this.spend(1)) return { ok: false, why: 'Not enough money' }; w.wire[i] = 0; this.needAn = true; return { ok: true, cost: 1 }; }
      return { ok: false };
    }
    if (tool === 'wire' || tool === 'cable') {
      const want = tool === 'wire' ? 1 : 2, cost = COST[tool];
      if (w.wire[i] === want) return { ok: false };
      if (w.wire[i] === 2 && want === 1) return { ok: false };
      if (want === 1 && !(k === T.EMPTY || k === T.ROAD || k === T.PARK)) return { ok: false, why: 'Overhead lines need open ground. Use cable' };
      if (!this.spend(cost)) return { ok: false, why: 'Not enough money' };
      w.wire[i] = want; w.tree[i] = 0; this.needAn = true;
      return { ok: true, cost };
    }
    const map = { road: T.ROAD, res: T.RES, com: T.COM, ind: T.IND, park: T.PARK };
    const nk = map[tool];
    const cost = tool === 'road' ? COST.road : tool === 'park' ? COST.park : COST.zone;
    if (k === nk) return { ok: false };
    if (k === T.SVC) return { ok: false, why: 'Bulldoze the building first' };
    if (k === T.ROAD) return { ok: false, why: 'Bulldoze the road first' };
    if (w.level[i] > 0) return { ok: false, why: 'Bulldoze the building first' };
    if (!this.spend(cost)) return { ok: false, why: 'Not enough money' };
    w.kind[i] = nk; w.level[i] = 0; w.tree[i] = 0; w.variant[i] = Math.floor(this.rnd() * 4);
    if (w.wire[i] === 1 && (nk === T.RES || nk === T.COM || nk === T.IND)) w.wire[i] = 0;
    if (nk === T.PARK) this.markBuilt(i, { kind: T.PARK, from: 0, to: 1 });
    this.needAn = true; this.recount();
    return { ok: true, cost };
  }
}
