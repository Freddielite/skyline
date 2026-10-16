import { T, N } from './world.js';
import { clamp, mulberry32 } from './util.js';

export const COST = { road: 10, zone: 5, park: 25, bulldoze: 2 };
export const POP_CAP = [0, 8, 24, 70];
export const COM_CAP = [0, 5, 14, 40];
export const IND_CAP = [0, 8, 18, 42];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    this.recount();
  }
  get year() { return 2026 + Math.floor(this.day / 360); }
  get month() { return Math.floor((this.day % 360) / 30); }
  get dom() { return (this.day % 30) + 1; }
  dateLabel() { return `${this.dom} ${MONTHS[this.month]} ${this.year}`; }
  state() { return { money: this.money, day: this.day, tax: this.tax, lastIncome: this.lastIncome, lastExpense: this.lastExpense }; }

  recount() {
    const w = this.w;
    let pop = 0, cj = 0, ij = 0, roads = 0, parks = 0, rb = 0, cb = 0, ib = 0;
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i], l = w.level[i];
      if (k === T.ROAD) roads++;
      else if (k === T.PARK) parks++;
      else if (k === T.RES && l) { pop += POP_CAP[l]; rb++; }
      else if (k === T.COM && l) { cj += COM_CAP[l]; cb++; }
      else if (k === T.IND && l) { ij += IND_CAP[l]; ib++; }
    }
    this.pop = pop; this.cJobs = cj; this.iJobs = ij; this.roads = roads; this.parks = parks;
    this.bld = { r: rb, c: cb, i: ib };
    const jobs = cj + ij;
    const tm = (t) => -(t - 9) * 0.04 + 0.14;
    this.rd = clamp((jobs - pop * 0.85 + 18) / (40 + jobs * 0.25) + tm(this.tax.r), -1, 1);
    this.cd = clamp((pop * 0.3 - cj + 4) / (30 + cj * 0.2) + tm(this.tax.c), -1, 1);
    this.id = clamp((pop * 0.4 - ij + 6) / (30 + ij * 0.2) + tm(this.tax.i), -1, 1);
    const avgTax = (this.tax.r + this.tax.c + this.tax.i) / 3;
    const parkBonus = Math.min(18, (parks * 400) / (pop + 100));
    this.happiness = clamp(Math.round(62 - (avgTax - 9) * 3.2 + parkBonus - Math.max(0, -this.rd) * 12), 0, 100);
  }

  landValue(x, y, z) {
    const w = this.w;
    let v = 40, parks = 0, ind = 0;
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
      const xx = x + i, yy = y + j;
      if (!w.inb(xx, yy)) continue;
      const k = w.kind[w.idx(xx, yy)];
      if (k === T.PARK) parks++;
      else if (k === T.IND && w.level[w.idx(xx, yy)] && Math.abs(i) <= 4 && Math.abs(j) <= 4) ind++;
    }
    v += Math.min(24, parks * 8);
    if (z === T.RES) v -= Math.min(24, ind * 6);
    if (w.roadNear(x, y, 1)) v += 8;
    return v;
  }

  tick() {
    this.day++;
    const w = this.w, rnd = this.rnd;
    const tries = 150;
    for (let n = 0; n < tries; n++) {
      const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N), i = w.idx(x, y);
      const z = w.kind[i];
      if (z !== T.RES && z !== T.COM && z !== T.IND) continue;
      const d = z === T.RES ? this.rd : z === T.COM ? this.cd : this.id;
      const lvl = w.level[i];
      const road = w.roadNear(x, y, 2);
      if (!road) { if (lvl && rnd() < 0.03) w.level[i] = lvl - 1; continue; }
      if (lvl === 0) {
        if (d > -0.05 && rnd() < 0.15 + 0.5 * Math.max(0, d)) { w.level[i] = 1; w.variant[i] = Math.floor(rnd() * 4); this.dirty = true; }
      } else if (lvl < 3) {
        const need = lvl === 1 ? 46 : 62;
        if (d > 0.04 && this.landValue(x, y, z) >= need && rnd() < 0.1 * d + 0.02) { w.level[i] = lvl + 1; w.variant[i] = Math.floor(rnd() * 4); this.dirty = true; }
        else if (d < -0.25 && rnd() < 0.06) { w.level[i] = lvl - 1; this.dirty = true; }
      } else if (d < -0.25 && rnd() < 0.06) { w.level[i] = 2; this.dirty = true; }
      if (lvl === 1 && d < -0.35 && rnd() < 0.05) { w.level[i] = 0; this.dirty = true; }
    }
    this.recount();
    if (this.day % 30 === 0) this.monthly();
  }

  monthly() {
    const inc = this.pop * (this.tax.r / 100) * 14 + this.cJobs * (this.tax.c / 100) * 16 + this.iJobs * (this.tax.i / 100) * 16;
    const exp = this.roads * 0.6 + this.parks * 1.5;
    this.lastIncome = Math.round(inc); this.lastExpense = Math.round(exp);
    this.money += this.lastIncome - this.lastExpense;
    this.events.push({ type: 'month', income: this.lastIncome, expense: this.lastExpense });
  }

  // ---- player actions ----
  spend(c) { if (this.money < c) return false; this.money -= c; return true; }
  place(tool, x, y) {
    const w = this.w;
    if (!w.buildable(x, y)) return { ok: false, why: 'Can\u2019t build on water' };
    const i = w.idx(x, y), k = w.kind[i];
    if (tool === 'bulldoze') {
      if (k === T.EMPTY && !w.tree[i]) return { ok: false };
      if (k !== T.EMPTY && !this.spend(COST.bulldoze)) return { ok: false, why: 'Not enough money' };
      w.kind[i] = T.EMPTY; w.level[i] = 0; w.tree[i] = 0; this.recount(); return { ok: true, cost: k ? COST.bulldoze : 0 };
    }
    const map = { road: T.ROAD, res: T.RES, com: T.COM, ind: T.IND, park: T.PARK };
    const nk = map[tool];
    const cost = tool === 'road' ? COST.road : tool === 'park' ? COST.park : COST.zone;
    if (k === nk) return { ok: false };
    if (k === T.ROAD) return { ok: false, why: 'Bulldoze the road first' };
    if (w.level[i] > 0) return { ok: false, why: 'Bulldoze the building first' };
    if (!this.spend(cost)) return { ok: false, why: 'Not enough money' };
    w.kind[i] = nk; w.level[i] = 0; w.tree[i] = 0; w.variant[i] = Math.floor(this.rnd() * 4);
    this.recount();
    return { ok: true, cost };
  }
}
