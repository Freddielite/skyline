import { T, N, TERRAIN, SHORE_NAME } from './world.js';
import { WF_NAME } from './waterfront.js';
import { clamp, mulberry32, hash } from './util.js';
import { BT, BY_KEY, ELEC, WATER, WASTE, CUT_STAGE, cutGroup, frontTiles, berthTile } from './buildings.js';
import { ORD, GOALS, UNLOCK, UNLOCK_NAME, LOANS, OVERDRAFT_RATE, TUTORIAL } from './rules.js';

export const COST = { avenue: 25, road: 10, bridge: 60, zone: 5, park: 25, bulldoze: 2, wire: 4, cable: 12, pipe: 6 };
export const BRIDGE_MAX = 12;                       // longest bridge, in tiles
export const POP_CAP = [0, 8, 24, 70, 160];
export const COM_CAP = [0, 5, 14, 40, 95];
export const IND_CAP = [0, 8, 18, 42, 70];
export const MAX_LEVEL = 4;
export const LEVEL_LV = [0, 46, 62, 78];           // land value a building needs to grow from level n to n + 1
const IND_POLL = [0, 7, 14, 21, 8];
const WF_LV = [0, 4, 6, 8];                          // land value bonus near a pond, a lake, the sea                 // hi-tech campuses pollute far less than heavy plants
export const LEVEL_NAME = {
  [T.RES]: ['Empty lot', 'House', 'Apartments', 'Residential tower', 'Skyscraper'],
  [T.COM]: ['Empty lot', 'Shop', 'Offices', 'Glass tower', 'Office megatower'],
  [T.IND]: ['Empty lot', 'Warehouse', 'Factory', 'Heavy plant', 'Hi-tech campus'],
};
export const ZONE_NAME = { [T.RES]: 'Homes', [T.COM]: 'Shops', [T.IND]: 'Industry' };
const COMMUTE = 18;                                  // road tiles people will travel to work (more with transit)
const CUT_NAMES = { fun: 'amenities', edu: 'schools', transit: 'buses', safety: 'police, fire and health care' };
const fmt$ = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ZK = { [T.RES]: 'r', [T.COM]: 'c', [T.IND]: 'i' };
const COVS = ['police', 'fire', 'health', 'edu', 'fun', 'transit', 'metro'];
// Seasons in the simulation (Menu → Seasons → Always summer turns them off): 0 spring, 1 summer, 2 autumn, 3 winter, by month.
export const SIM_SEASON = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3];
export const SEASON_NAME = ['Spring', 'Summer', 'Autumn', 'Winter'];
// Specialised industry (stored in bits 4-5 of world.variant): 0 general, 1 farm, 2 forestry, 3 tech.
export const SPEC_NAME = ['', 'Farm', 'Forestry', 'Tech'];
export const SPEC_TITLE = [null, ['', 'Farm', 'Farmstead', 'Large farm', 'Agri-tech farm'], ['', 'Sawmill', 'Timber yard', 'Wood mill', 'Mass timber works'], ['', 'Tech workshop', 'Software studio', 'Tech park', 'Hi-tech campus']];
const SPEC_JOBS = [1, 0.6, 0.8, 1.25], SPEC_POLL = [1, 0.25, 0.6, 0.2], SPEC_TAX = [1, 0.85, 1, 1.4];
export const specOf = (w, i) => (w.kind[i] === T.IND ? (w.variant[i] >> 4) & 3 : 0);
// Requests from residents and businesses: a goal with a deadline, or a choice. One at a time, every few months.
const REQUESTS = [
  { id: 'health', when: (s) => s.pop >= 150 && s.net.health < 0.4, title: 'Families ask for health care', text: 'Get health care coverage to 50% of homes.', months: 4, check: (s) => s.net.health >= 0.5, prog: (s) => `${Math.round(s.net.health * 100)}% of 50%`, win: { money: 1500, happy: 4 }, lose: { happy: -3 } },
  { id: 'parks', when: (s) => s.pop >= 80 && s.parks < s.pop / 80, title: 'Residents want more parks', text: 'Build 4 more parks.', months: 3, base: (s) => s.parks, check: (s, b) => s.parks >= b + 4, prog: (s, b) => `${Math.max(0, s.parks - b)} of 4`, win: { money: 800, happy: 3 }, lose: { happy: -2 } },
  { id: 'bus', when: (s) => s.pop >= 300 && s.net.transit < 0.2, title: 'Commuters ask for buses', text: 'Get bus coverage to 30% of homes.', months: 5, check: (s) => s.net.transit >= 0.3, prog: (s) => `${Math.round(s.net.transit * 100)}% of 30%`, win: { money: 2000, happy: 3 }, lose: { happy: -2 } },
  { id: 'air', when: (s) => s.pop >= 200 && s.net.pollAvg > 15, title: 'Clean up the air', text: 'Bring average pollution at homes below 12.', months: 6, check: (s) => s.net.pollAvg < 12, prog: (s) => `now ${Math.round(s.net.pollAvg)}`, win: { money: 2500, happy: 4 }, lose: { happy: -3 } },
  { id: 'jobs', when: (s) => s.pop >= 100 && s.rd < -0.2, title: 'Job seekers need work', text: 'Add 30 jobs in shops or industry.', months: 4, base: (s) => s.cJobs + s.iJobs, check: (s, b) => s.cJobs + s.iJobs >= b + 30, prog: (s, b) => `${Math.max(0, s.cJobs + s.iJobs - b)} of 30`, win: { money: 1500, happy: 3 }, lose: { happy: -2 } },
  { id: 'tax', when: (s) => s.tax.r >= 11, title: 'Petition for lower taxes', text: 'Have residential tax at 9% or less when the deadline comes.', months: 2, check: (s) => s.tax.r <= 9, atEnd: true, prog: (s) => `now ${s.tax.r}%`, win: { happy: 5 }, lose: { happy: -3 } },
  { id: 'tourism', when: (s) => s.pop >= 400 && s.attraction < 60 && s.SEASON_NOW !== 3, title: 'Shops want visitors', text: 'Get 60 tourists a month (beaches, marinas, piers, museums, stadiums).', months: 6, check: (s) => s.tourists >= 60, prog: (s) => `${s.tourists} of 60`, win: { money: 2000, happy: 2 }, lose: { happy: -1 } },
  { id: 'factory', choice: true, when: (s) => s.pop >= 200 && s.iJobs >= 30, title: 'A factory wants to expand', text: 'The owners will pay $4,000 to expand next to homes. Neighbours won\u2019t like it.',
    choices: [{ label: 'Allow (+$4,000, \u22123 happiness)', money: 4000, happy: -3 }, { label: 'Refuse (+2 happiness)', happy: 2 }] },
  { id: 'festival', choice: true, when: (s) => s.pop >= 300 && s.SEASON_NOW === 1, title: 'Summer festival?', text: 'Hold a festival in the parks: residents love it and it draws visitors for two months.',
    choices: [{ label: 'Hold it ($1,500)', money: -1500, happy: 6, tour: 1.3 }, { label: 'Not this year' }] },
  { id: 'snow', choice: true, when: (s) => s.roads >= 40 && s.SEASON_NOW === 3, title: 'Snow on the roads', text: 'Heavy snow is slowing traffic. Clearing it costs money; waiting annoys commuters.',
    choices: [{ label: 'Clear it ($600)', money: -600 }, { label: 'Wait it out (\u22123 happiness)', happy: -3 }] },
];
const KERN = [];
function kern(R) {                                    // tiles within radius R and their 1 - d / R falloff
  if (KERN[R]) return KERN[R];
  const dx = [], dy = [], f = [];
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const d = Math.hypot(x, y); if (d <= R) { dx.push(x); dy.push(y); f.push(1 - d / (R + 0.001)); } }
  return (KERN[R] = { dx: Int8Array.from(dx), dy: Int8Array.from(dy), f: Float64Array.from(f), n: dx.length });
}
const D24 = []; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) D24.push([i, j]);

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
    this.ord = s.ord ?? {}; this.done = new Set(s.done ?? []); this.streak = s.streak ?? 0; this.disasters = s.disasters ?? 1; this.grant = 0;
    this.loans = s.loans ?? [];                    // { amount, pay, left } bank loans repaid monthly
    this.lastInterest = s.lastInterest ?? 0; this.lastLoanPay = s.lastLoanPay ?? 0;
    this.history = s.history ?? [];                // one row per month for the charts
    this.news = s.news ?? [];
    this.req = s.req ?? null; this.reqNext = s.reqNext ?? 60; this.reqDone = s.reqDone ?? 0;   // the open request and when the next may come
    this.moods = s.moods ?? [];                     // temporary happiness from requests: { v, until (day) }
    this.tourBoost = s.tourBoost ?? null;           // { k, until }: a festival draws extra visitors
    this.seasonsOn = true; this.tourists = 0; this.attraction = 0; this.beds = 0; this.tourIncome = 0; this.avenues = 0; this.metroLinked = false;
    this.peakPop = s.peakPop ?? 0;
    this.tut = s.tut ?? (s.day ? TUTORIAL.length : 0);   // older cities skip the guide
    this.inspected = !!s.inspected;
    this.cut = 0; this.happiness = 60; this.hapParts = []; this.advice = [];
    this.traffic = null;                           // live congestion map, set by the game
    this.unlocked = new Set();
    this.events = [];
    this.grace = this.day + 90;         // older saves get time to wire up before buildings decay
    const n = N * N;
    this.pw = new Uint8Array(n); this.wt = new Uint8Array(n); this.ts = new Uint8Array(n);
    this.lv = new Float32Array(n); this.indPen = new Float32Array(n);
    this.crime = new Float32Array(n); this.poll = new Float32Array(n);
    this.cov = {}; for (const k of COVS) this.cov[k] = new Float32Array(n);
    this.powerMap = new Uint8Array(n); this.waterMap = new Uint8Array(n); this.wasteMap = new Uint8Array(n);
    this.facilities = [];
    this.hwNet = new Uint8Array(n); this.jobReach = new Uint8Array(n); this.workReach = new Uint8Array(n);
    this.seaLink = new Uint8Array(n);              // land tiles: 1 = ships from here reach the open sea, 2 = a bridge blocks the way, 0 = inland water or none
    this.ports = 0; this.portsBlocked = 0;
    this.commute = new Float32Array(n); this.jam = new Float32Array(n); this.roadComp = new Int32Array(n);
    this.hwRoads = 0; this.hasUni = false; this.plants = 0; this.zoned = { r: 0, c: 0, i: 0 };
    this.pending = new Map();          // tile -> { from } while a building is still under construction
    this.defer = false;                // set by the game: new buildings only count once finished
    this.net = { pSup: 0, pDem: 0, wSup: 0, wDem: 0, tSup: 0, tDem: 0, unserved: 0, wasteUn: 0, upkeep: 0, crimeAvg: 0, pollAvg: 0, police: 0, fire: 0, health: 0, edu: 0, fun: 0, transit: 0, stadiums: 0, jamAvg: 0, noJob: 0, noJobN: 0, noWorkN: 0, offGrid: 0 };
    this.recount();
    this.peakPop = Math.max(this.peakPop, this.pop);
    for (const k in UNLOCK) if (this.peakPop >= UNLOCK[k]) this.unlocked.add(k);
    this.updateCut(true);
    this.analyze();
  }
  lvl(i) { const p = this.pending.get(i); return p ? p.from : this.w.level[i]; }     // level that currently counts
  // A lot can sell its goods to the region by the highway, or (industry only) as a harbor whose ships reach the open sea.
  linkedOut(i) { return !!this.hwNet[i] || (this.w.kind[i] === T.IND && this.seaLink[i] === 1); }
  isHarbor(i) { return this.w.kind[i] === T.IND && this.w.shore[i] >= 2; }
  markBuilt(i, ev) { this.events.push({ type: 'built', i, ...ev }); if (this.defer) this.pending.set(i, { from: ev.from }); }
  finish(i) {
    const p = this.pending.get(i);
    if (this.pending.delete(i)) {
      const w = this.w, l = w.level[i];
      if (w.kind[i] === T.RES && p && l > p.from) this.events.push({ type: 'moveIn', i, n: POP_CAP[l] - POP_CAP[p.from] });   // new residents arrive
      this.needAn = true; this.recount();
    }
  }
  get year() { return 2026 + Math.floor(this.day / 360); }
  get month() { return Math.floor((this.day % 360) / 30); }
  get dom() { return (this.day % 30) + 1; }
  get SEASON_NOW() { return this.seasonsOn ? SIM_SEASON[this.month] : 1; }
  dateLabel() { return `${this.dom} ${MONTHS[this.month]} ${this.year}`; }
  state() { return { req: this.req, reqNext: this.reqNext, reqDone: this.reqDone, moods: this.moods, tourBoost: this.tourBoost, money: this.money, day: this.day, tax: this.tax, lastIncome: this.lastIncome, lastExpense: this.lastExpense, ord: this.ord, done: [...this.done], streak: this.streak, disasters: this.disasters, loans: this.loans, lastInterest: this.lastInterest, lastLoanPay: this.lastLoanPay, history: this.history, news: this.news, peakPop: this.peakPop, tut: this.tut, inspected: this.inspected }; }
  ordOn(k) { return !!this.ord[k] && this.cut === 0; }          // ordinances are suspended while the city is in debt
  isUnlocked(k) { return !UNLOCK[k] || this.unlocked.has(k); }
  closed(def) { const g = cutGroup(def); return !!g && this.cut >= CUT_STAGE[g]; }
  isClosedAt(i) { return this.w.kind[i] === T.SVC && this.closed(BT[this.w.bt[i]]); }
  pushNews(text) { this.news.unshift({ date: this.dateLabel(), text }); if (this.news.length > 30) this.news.length = 30; this.events.push({ type: 'news', text }); }

  recount() {
    const w = this.w;
    let iTax = 0, avenues = 0, ports = 0, blocked = 0, bridges = 0, pop = 0, cj = 0, ij = 0, roads = 0, parks = 0, rb = 0, cb = 0, ib = 0, top = 0, zr = 0, zc = 0, zi = 0, plants = 0;
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i], l = this.lvl(i);
      if (k === T.ROAD) { roads++; if (w.terrain[i] === TERRAIN.WATER) bridges++; else if (w.level[i] === 1) avenues++; }
      else if (k === T.PARK) { if (!this.pending.has(i)) parks++; }
      else if (k === T.RES) { zr++; if (l) { pop += POP_CAP[l]; rb++; } }
      else if (k === T.COM) { zc++; if (l) { cj += COM_CAP[l]; cb++; } }
      else if (k === T.IND) { zi++; if (l) { const sp = (w.variant[i] >> 4) & 3, jobs = Math.round(IND_CAP[l] * SPEC_JOBS[sp]); ij += jobs; iTax += jobs * SPEC_TAX[sp] * (sp === 1 && this.SEASON_NOW === 2 ? 1.5 : 1); ib++; if (w.shore[i] >= 2) { if (this.seaLink[i] === 1) ports++; else if (this.seaLink[i] === 2) blocked++; } } }
      else if (k === T.SVC && w.bo[i] === 0 && BT[w.bt[i]].power) plants++;
      if (l === 4 && k >= T.RES && k <= T.IND) top++;
    }
    this.ports = ports; this.portsBlocked = blocked; this.iTax = iTax; this.avenues = avenues;
    this.pop = pop; this.cJobs = cj; this.iJobs = ij; this.roads = roads; this.bridges = bridges; this.parks = parks; this.plants = plants;
    this.bld = { r: rb, c: cb, i: ib, top }; this.zoned = { r: zr, c: zc, i: zi };
    const jobs = cj + ij;
    const tm = (t) => -(t - 9) * 0.04 + 0.14;
    const stad = Math.min(3, this.net.stadiums) * 0.06 + (this.ordOn('tourism') ? 0.08 : 0);
    const mood = ((this.happiness ?? 60) - 55) / 100 * 0.6;       // a happy city attracts people, an unhappy one drives them off
    const linked = this.hwRoads > 0;
    this.rd = clamp((jobs - pop * 0.85 + 18) / (40 + jobs * 0.25) + tm(this.tax.r) + mood, -1, 1);
    const sn = this.SEASON_NOW, seasonK = sn === 3 ? -0.06 : sn === 0 ? 0.03 : 0;            // winter slows building, spring speeds it up
    this.rd += seasonK;
    this.cd = clamp((pop * 0.3 - cj + 4) / (30 + cj * 0.2) + tm(this.tax.c) + stad + (linked ? 0 : -0.15) + seasonK + Math.min(0.25, this.tourists / (cj * 4 + 120)), -1, 1);   // visitors shop too
    const port = ports > 0 ? 0.08 : 0;                         // a working sea port draws a little more industry
    this.id = clamp((pop * 0.4 - ij + 6) / (30 + ij * 0.2) + tm(this.tax.i) + (linked || ports ? 0 : -0.3) + port, -1, 1);   // goods leave by the highway or by sea
    this.updateHappiness();
  }
  updateHappiness() {
    const n = this.net, avgTax = (this.tax.r + this.tax.c + this.tax.i) / 3;
    const parkBonus = Math.min(18, (this.parks * 400) / (this.pop + 100));
    const parts = []; let h = 58;
    const add = (label, v) => { h += v; if (Math.abs(v) >= 0.5) parts.push([label, Math.round(v)]); };
    add('Taxes', -(avgTax - 9) * 3.2); add('Parks', parkBonus); add('Too few jobs', -Math.max(0, -this.rd) * 12);
    add('Police', n.police * 7); add('Health care', n.health * 7); add('Schools', n.edu * 6); add('Fire safety', n.fire * 3); add('Amenities', n.fun * 8); add('Buses', n.transit * 4); add('Metro', (n.metro || 0) * 5);
    add('Crime', -n.crimeAvg * 0.18); add('Pollution', -n.pollAvg * 0.16); add('Power cuts', -n.unserved * 30); add('Garbage', -n.wasteUn * 18);
    add('Traffic', -n.jamAvg * 12); add('Long commutes', -n.noJob * 14); add('Budget cuts', -[0, 3, 7, 12][this.cut]);
    const sn = this.SEASON_NOW; add(sn === 3 ? 'Winter' : sn === 1 ? 'Summer' : 'Season', sn === 3 ? -2 + n.health * 1.5 : sn === 1 ? 1 + Math.min(2, n.fun * 3) : 0);
    add('Requests', this.moods.reduce((a, m) => a + (m.until > this.day ? m.v : 0), 0));
    this.hapParts = parts.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    this.happiness = clamp(Math.round(h), 0, 100);
  }

  // ---- networks, coverage and value maps ----
  // Full recalculation, used after the player builds something. Same work as the staged version below.
  analyze() { this.anStep = -1; this.needAn = false; this.anNetworks(); this.anCoverage(); this.anRoads(); this.anLand(); this._an = null; }
  // Batched recalculation from the daily tick, spread over four frames so no single frame stalls on a slow phone.
  startAnalyze() { if (this.anStep >= 0) return; this.anStep = 0; this.needAn = false; }
  stepAnalyze() {
    if (!(this.anStep >= 0)) return false;
    const st = this.anStep;
    if (st === 0) this.anNetworks(); else if (st === 1) this.anCoverage(); else if (st === 2) this.anRoads(); else { this.anLand(); this._an = null; }
    this.anStep = st === 3 ? -1 : st + 1;
    return true;
  }
  // stage 1: power, water and waste networks
  anNetworks() {
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
    const heat = this.SEASON_NOW === 3 ? 1.25 : 1;                 // homes use more power for heating in winter
    for (const z of zones) consumers.push({ i: z.i, x: z.x, y: z.y, fw: 1, fd: 1, p: Math.ceil(ELEC[z.z][z.l] * (this.ordOn('energy') ? 0.85 : 1) * (z.z === 'r' ? heat : 1)), wa: Math.ceil(WATER[z.z][z.l] * (this.ordOn('water') ? 0.8 : 1)), ws: Math.ceil(WASTE[z.z][z.l] * (this.ordOn('recycle') ? 0.75 : 1)), zone: true });
    for (const a of anchors) if (!a.def.power && a.def.use && !this.closed(a.def)) consumers.push({ i: a.i, x: a.x, y: a.y, fw: a.def.w, fd: a.def.d, p: a.def.use, wa: a.def.water ? 0 : 2, ws: 0 });
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

    // water: sources must touch a pipe; buildings pick up water from pipes within 2 tiles
    const pc = new Int32Array(n).fill(-1), pp = []; let pn = 0;
    for (let s0 = 0; s0 < n; s0++) {
      if (!w.pipe[s0] || pc[s0] >= 0) continue;
      pc[s0] = pn; pp.push(pn); stack.push(s0);
      while (stack.length) {
        const c = stack.pop(), x = c % N, y = (c / N) | 0;
        for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (!w.inb(xx, yy)) continue; const q = yy * N + xx; if (w.pipe[q] && pc[q] < 0) { pc[q] = pn; stack.push(q); } }
      }
      pn++;
    }
    const pfind = (a) => { while (pp[a] !== a) { pp[a] = pp[pp[a]]; a = pp[a]; } return a; };
    const punion = (a, b) => { a = pfind(a); b = pfind(b); if (a !== b) pp[b] = a; };
    const pring = (x0, y0, fw, fd, r, fn) => { for (let y = y0 - r; y < y0 + fd + r; y++) for (let x = x0 - r; x < x0 + fw + r; x++) if (w.inb(x, y)) fn(pc[y * N + x]); };
    const sources = anchors.filter((a) => a.def.water);
    for (const a of sources) { let first = -1; pring(a.x, a.y, a.def.w, a.def.d, 1, (c) => { if (c >= 0) { if (first < 0) first = c; else punion(first, c); } }); a.pcomp = first; }
    const wout = new Map(), wdem = new Map(); let wSup = 0, wDem = 0;
    for (const a of sources) { wSup += a.def.water; if (a.pcomp >= 0) { const r = pfind(a.pcomp); wout.set(r, (wout.get(r) || 0) + a.def.water * (a.def.use && !this.pw[a.i] ? 0.3 : 1)); } }
    for (const c of consumers) {
      wDem += c.wa; let root = -1; pring(c.x, c.y, c.fw, c.fd, 2, (cc) => { if (root < 0 && cc >= 0) root = pfind(cc); });
      c.wroot = root; if (root >= 0) wdem.set(root, (wdem.get(root) || 0) + c.wa);
    }
    this.wt.fill(0); this.waterMap.fill(0);
    for (const c of consumers) {
      const o = c.wroot >= 0 ? wout.get(c.wroot) || 0 : 0, d = wdem.get(c.wroot) || 1, ratio = Math.min(1, o / d);
      const ok = c.wroot >= 0 && o > 0 && hash(c.x, c.y, 2) < ratio + 1e-6;
      this.wt[c.i] = ok ? 1 : 0; this.waterMap[c.i] = ok ? 3 : 2;
    }
    for (let i = 0; i < n; i++) if (pc[i] >= 0 && this.waterMap[i] === 0) this.waterMap[i] = (wout.get(pfind(pc[i])) || 0) > 0 ? 4 : 5;

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

    this._an = { anchors, zones, empties, consumers, unpowered, pSup, pDem, wSup, wDem, tDem, tSup, wUn, zc };
  }
  // stage 2: service and amenity coverage
  anCoverage() {
    const { anchors } = this._an;
    for (const k of COVS) this.cov[k].fill(0);
    this.linkFerries(anchors);
    this.metroLinked = anchors.filter((a) => a.def.metro && !this.closed(a.def)).length >= 2;
    let upkeep = 0, stadiums = 0;
    let uni = false;
    for (const a of anchors) {
      const shut = this.closed(a.def);
      upkeep += a.def.upkeep * (shut ? 0.2 : 1);       // a closed building only costs basic maintenance
      if (shut) continue;
      if (a.def.key === 'stadium') stadiums++;
      if (a.def.key === 'university') uni = true;
      if (!a.def.cov) continue;
      if (a.def.ferry && !this.ferryLinks.get(a.i)) continue;      // a ferry pier only serves once a ferry runs to another pier
      if (a.def.metro && !this.metroLinked) continue;               // a metro needs at least two stations
      const eff = a.def.use === undefined || this.pw[a.i] ? 1 : 0.3, R = a.def.radius, cx = a.x + a.def.w / 2, cy = a.y + a.def.d / 2;
      for (const [key, str] of a.def.cov) {
        const arr = this.cov[key];
        for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d >= R) continue;
          const v = Math.min(1, (1 - d / R) * 1.6 * str) * eff, q = y * N + x; if (v > arr[q]) arr[q] = v;
        }
      }
    }
    this.hasUni = uni; this._an.upkeep = upkeep; this._an.stadiums = stadiums;
  }
  // stage 3: road networks, highway link and commutes (only when roads changed or every 6 days)
  anRoads() {
    const { zones, empties } = this._an;
    if (this.roadsDirty !== false || this.day - (this.roadsDay ?? -99) >= 6) { this.analyzeRoads(zones, empties); this.roadsDirty = false; this.roadsDay = this.day; }

  }
  // stage 4: pollution, density, crime, land value, then the city-wide totals
  anLand() {
    const w = this.w, n = N * N, { anchors, consumers, unpowered, pSup, pDem, wSup, wDem, tDem, tSup, wUn, zc, upkeep, stadiums } = this._an;
    const poll = this.poll, dens = new Float32Array(n), parkAcc = new Float32Array(n), ind = this.indPen;
    poll.fill(0); ind.fill(0);
    // add a value to every tile within radius R, scaled by distance falloff when useF is set (precomputed kernels, no per-tile closures)
    const add = (arr, x0, y0, R, amt, useF) => {
      const K = kern(R), dx = K.dx, dy = K.dy, f = K.f;
      if (x0 >= R && y0 >= R && x0 < N - R && y0 < N - R) { const b = y0 * N + x0; for (let j = 0; j < K.n; j++) arr[b + dy[j] * N + dx[j]] += useF ? amt * f[j] : amt; return; }
      for (let j = 0; j < K.n; j++) { const x = x0 + dx[j], y = y0 + dy[j]; if (x < 0 || y < 0 || x >= N || y >= N) continue; arr[y * N + x] += useF ? amt * f[j] : amt; }
    };
    const scrub = this.ordOn('scrub') ? 0.7 : 1;
    for (let i = 0; i < n; i++) {
      const k = w.kind[i];
      if (k !== T.IND && k !== T.PARK && k !== T.RES && k !== T.COM) continue;
      const x = i % N, y = (i / N) | 0, l = this.lvl(i);
      if (k === T.IND && l) { add(poll, x, y, 4, IND_POLL[l] * scrub * SPEC_POLL[(w.variant[i] >> 4) & 3], true); add(ind, x, y, 4, l === 4 ? 2 : 6, false); }
      else if (k === T.PARK && !this.pending.has(i)) { add(parkAcc, x, y, 5, 8, false); add(poll, x, y, 3, -8, true); }
      else if ((k === T.RES || k === T.COM) && l) add(dens, x, y, 3, (k === T.RES ? POP_CAP[l] : COM_CAP[l] * 0.5) * 0.25, true);
      if (ZK[k] && l && !this.ts[i]) add(poll, x, y, 2, l * 3, true);   // uncollected garbage
    }
    for (let i = 0; i < n; i++) if (this.jam[i] > 0) poll[i] += this.jam[i] * 6;            // exhaust and noise from jammed roads
    for (const a of anchors) if (a.def.pollute) add(poll, a.x, a.y, a.def.pr || 6, a.def.pollute * scrub, true);
    let pv = 0, polSum = 0, crSum = 0, jamSum = 0, noJobW = 0; const covS = {}; for (const k of COVS) covS[k] = 0;
    for (let i = 0; i < n; i++) {
      poll[i] = clamp(poll[i], 0, 100);
      this.crime[i] = clamp((10 + dens[i] * 0.5 + poll[i] * 0.12 - this.cov.police[i] * 55) * (this.ordOn('watch') ? 0.85 : 1), 0, 100);
      const x = i % N, y = (i / N) | 0;
      let v = 40 + Math.min(24, parkAcc[i]) + (w.roadNear(x, y, 1) ? 8 : 0);
      v += WF_LV[w.shore[i]];
      v += this.cov.police[i] * 5 + this.cov.health[i] * 6 + this.cov.edu[i] * 6 + this.cov.fire[i] * 4 + this.cov.fun[i] * 6 + this.cov.transit[i] * 5 - poll[i] * 0.28 - this.crime[i] * 0.12 - this.jam[i] * 12;
      this.lv[i] = clamp(v, 0, 100);
      if (w.kind[i] === T.RES && this.lvl(i)) { const wgt = POP_CAP[this.lvl(i)]; pv += wgt; polSum += poll[i] * wgt; crSum += this.crime[i] * wgt; jamSum += this.jam[i] * wgt; if (!this.jobReach[i]) noJobW += wgt; for (const k of COVS) covS[k] += this.cov[k][i] * wgt; }
    }
    const pvv = Math.max(1, pv);
    Object.assign(this.net, { pSup, pDem, wSup, wDem, tSup, tDem, unserved: consumers.length ? unpowered / consumers.length : 0, wasteUn: zc ? wUn / zc : 0, upkeep, stadiums, crimeAvg: pv ? crSum / pvv : 0, pollAvg: pv ? polSum / pvv : 0, police: covS.police / pvv, fire: covS.fire / pvv, health: covS.health / pvv, edu: covS.edu / pvv, fun: covS.fun / pvv, transit: covS.transit / pvv,
      jamAvg: pv ? jamSum / pvv : 0, noJob: pv && this.cJobs + this.iJobs >= 40 ? noJobW / pvv : 0 });
    this.tourism(anchors);
    this.updateHappiness();
    this.recount();
    this.advice = this.makeAdvice();
  }

  // Visitors: what draws them (the waterfront, piers, beaches, marinas, museums, stadiums, plazas, parks) times the season,
  // up to the hotel beds the city has (shops at level 3 and up, waterfront shops at level 2 and up).
  tourism(anchors) {
    const w = this.w; let at = this.parks * 1.2, beds = 30;
    const AT = { pier: 15, beach: 40, marina: 60, museum: 50, stadium: 120, plaza: 20, library: 6 };
    for (const a of anchors) if (AT[a.def.key] && !this.closed(a.def)) at += AT[a.def.key];
    for (let i = 0; i < N * N; i++) if (w.kind[i] === T.COM) { const l = this.lvl(i), sh = w.shore[i]; if (sh === 3 && l >= 1) at += 6; else if (sh === 2 && l >= 1) at += 3; if (l >= 3) beds += 12; else if (sh >= 2 && l >= 2) beds += 8; }
    const mult = [1, 1.6, 0.9, 0.5][this.SEASON_NOW] * (this.tourBoost && this.tourBoost.until > this.day ? this.tourBoost.k : 1);
    this.attraction = Math.round(at); this.beds = beds;
    this.tourists = this.pop < 50 ? 0 : Math.round(Math.min(at * mult, beds));
  }
  // ---- requests ----
  reqDef(id) { return REQUESTS.find((r) => r.id === id); }
  requestView() {
    const r = this.req; if (!r) return null; const d = this.reqDef(r.id); if (!d) return null;
    return { id: d.id, title: d.title, text: d.text, choice: !!d.choice, choices: d.choice ? d.choices.map((c) => c.label) : null, left: Math.max(0, Math.ceil((r.deadline - this.day) / 30)), prog: d.prog ? d.prog(this, r.base) : null, win: d.win || null };
  }
  applyEffect(e) {
    if (!e) return;
    if (e.money) this.money += e.money;
    if (e.happy) this.moods.push({ v: e.happy, until: this.day + (e.happy > 0 ? 180 : 90) });
    if (e.tour) this.tourBoost = { k: e.tour, until: this.day + 60 };
    this.updateHappiness();
  }
  answerRequest(n) {
    const r = this.req; if (!r) return; const d = this.reqDef(r.id); if (!d || !d.choice) return;
    const c = d.choices[n]; this.applyEffect(c); this.req = null; this.reqNext = this.day + 90 + Math.floor(this.rnd() * 60); this.reqDone++;
    this.pushNews(`${d.title}: ${c.label.replace(/ \(.*\)$/, '').toLowerCase()}`);
  }
  monthlyRequests() {
    this.moods = this.moods.filter((m) => m.until > this.day);
    const r = this.req;
    if (r) {
      const d = this.reqDef(r.id); if (!d) { this.req = null; return; }
      if (d.choice) { if (this.day >= r.deadline) this.answerRequest(d.choices.length - 1); return; }   // no answer: the last choice
      const done = !d.atEnd && d.check(this, r.base), end = this.day >= r.deadline;
      if (done || end) {
        const ok = done || d.check(this, r.base); this.applyEffect(ok ? d.win : d.lose);
        this.events.push({ type: 'request', title: d.title, ok }); this.pushNews(ok ? `${d.title}: done, residents thank the city` : `${d.title}: the deadline passed`);
        this.req = null; this.reqNext = this.day + 90 + Math.floor(this.rnd() * 60); this.reqDone++;
      }
      return;
    }
    if (this.day < this.reqNext || this.pop < 60) return;
    const open = REQUESTS.filter((q) => q.when(this)); if (!open.length) { this.reqNext = this.day + 30; return; }
    const d = open[Math.floor(this.rnd() * open.length)];
    this.req = { id: d.id, start: this.day, deadline: this.day + (d.choice ? 60 : d.months * 30), base: d.base ? d.base(this) : 0 };
    this.events.push({ type: 'request', title: d.title, fresh: true });
  }
  ordCost() { if (this.cut) return 0; let c = 0; for (const k in this.ord) if (this.ord[k] && ORD[k]) c += ORD[k].cost; return c; }
  setOrd(k, on) { if (!ORD[k]) return; this.ord[k] = !!on; this.needAn = true; this.recount(); }
  countServed(kind) { let n = 0; const w = this.w; for (let i = 0; i < N * N; i++) { const k = w.kind[i]; if ((k === T.RES || k === T.COM || k === T.IND) && this.lvl(i) && this[kind][i]) n++; } return n; }
  countBuilt(key) { const id = BY_KEY[key].id, w = this.w; let n = 0; for (let i = 0; i < N * N; i++) if (w.kind[i] === T.SVC && w.bt[i] === id && w.bo[i] === 0 && !this.pending.has(i)) n++; return n; }
  goalStatus() { return GOALS.map((g) => { const v = g.v(this); return { id: g.id, title: g.title, desc: g.desc, reward: g.reward, done: this.done.has(g.id), progress: Math.min(1, v / g.t), label: g.fmt ? g.fmt(v) : Math.min(v, g.t) + ' / ' + g.t }; }); }
  checkGoals() { for (const g of GOALS) { if (this.done.has(g.id)) continue; if (g.v(this) >= g.t) { this.done.add(g.id); this.money += g.reward; this.events.push({ type: 'goal', title: g.title, reward: g.reward }); } } }
  landValue(i, z) { return this.lv[i] - (z === T.RES ? Math.min(24, this.indPen[i]) : 0); }

  // ---- roads: highway link, commutes and congestion ----
  analyzeRoads(zones, empties) {
    const w = this.w, n = N * N, rc = this.roadComp;
    rc.fill(-1);
    const hwComp = new Set(), stack = []; let nc = 0;
    for (let s0 = 0; s0 < n; s0++) {
      if (w.kind[s0] !== T.ROAD || rc[s0] >= 0) continue;
      rc[s0] = nc; stack.push(s0); let hw = false;
      while (stack.length) {
        const c = stack.pop(), x = c % N, y = (c / N) | 0; if (w.hw[c]) hw = true;
        for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (!w.inb(xx, yy)) continue; const q = yy * N + xx; if (w.kind[q] === T.ROAD && rc[q] < 0) { rc[q] = nc; stack.push(q); } }
      }
      if (hw) hwComp.add(nc);
      nc++;
    }
    let hwRoads = 0;
    for (let i = 0; i < n; i++) if (rc[i] >= 0 && hwComp.has(rc[i]) && !w.hw[i]) hwRoads++;
    this.hwRoads = hwRoads; this.hwRoadComp = hwComp;

    // congestion near each tile (0 free flowing .. 1 gridlock), from the live traffic map
    const jam = this.jam, tr = this.traffic; jam.fill(0);
    if (tr) for (let i = 0; i < n; i++) {
      if (w.kind[i] !== T.ROAD) continue;
      const cap = w.level[i] === 1 && w.terrain[i] !== TERRAIN.WATER ? 2 : 1;              // an avenue carries twice the traffic
      const v = clamp((tr[i] - 0.7 * cap) / (1.3 * cap), 0, 1); if (v <= 0) continue;
      const x = i % N, y = (i / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (w.inb(xx, yy)) { const q = yy * N + xx; if (v > jam[q]) jam[q] = v; } }
    }
    // travel cost along roads: jammed roads count as longer trips
    const cost = (i) => 1 + (tr ? clamp((tr[i] - 0.6 * (w.level[i] === 1 ? 2 : 1)) * (w.level[i] === 1 ? 0.6 : 1.2), 0, 2.5) : 0);
    const roadsNear = (x, y) => { const out = []; for (const [dx, dy] of D24) { const xx = x + dx, yy = y + dy; if (w.inb(xx, yy)) { const q = yy * N + xx; if (w.kind[q] === T.ROAD) out.push(q); } } return out; };
    const dijkstra = (srcs) => {             // binary heap on typed arrays: no per-step allocations for the garbage collector
      const dist = new Float32Array(n).fill(1e9), cap = srcs.length + 4 * n + 4, hd = new Float64Array(cap), hi = new Int32Array(cap);
      let len = 0;
      const push = (d, i) => { let k = len++; while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= d) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; } hd[k] = d; hi[k] = i; };
      for (const q of srcs) if (dist[q] > 0) { dist[q] = 0; push(0, q); }
      while (len) {
        const d = hd[0], c = hi[0];
        len--;
        if (len) {                                   // sift the last entry down from the top
          const ld = hd[len], li = hi[len]; let k = 0;
          for (;;) { const l = 2 * k + 1, r = l + 1; if (l >= len) break; const m = r < len && hd[r] < hd[l] ? r : l; if (hd[m] >= ld) break; hd[k] = hd[m]; hi[k] = hi[m]; k = m; }
          hd[k] = ld; hi[k] = li;
        }
        if (d > dist[c] || d > 60) continue;
        const x = c % N, y = (c / N) | 0;
        for (let j = 0; j < 4; j++) { const xx = x + D4[j][0], yy = y + D4[j][1]; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const q = yy * N + xx; if (w.kind[q] !== T.ROAD) continue; const nd = d + cost(q); if (nd < dist[q]) { dist[q] = nd; push(nd, q); } }
      }
      return dist;
    };
    const jobSrc = [], homeSrc = [];
    for (const z of zones) { if (this.pending.has(z.i)) continue; const rs = roadsNear(z.x, z.y); (z.z === 'r' ? homeSrc : jobSrc).push(...rs); }
    const jobD = dijkstra(jobSrc), homeD = dijkstra(homeSrc);
    this.hwNet.fill(0); this.jobReach.fill(0); this.workReach.fill(0); this.commute.fill(255);
    let noJobN = 0, noWorkN = 0, offGrid = 0;
    const few = this.cJobs + this.iJobs < 40, fewPeople = this.pop < 40;     // a brand-new town gets a pass
    for (const z of zones.concat(empties)) {
      const k = w.kind[z.i], rs = roadsNear(z.x, z.y);
      let best = 1e9, hw = false;
      const D = k === T.RES ? jobD : homeD;
      for (const q of rs) { if (hwComp.has(rc[q])) hw = true; if (D[q] < best) best = D[q]; }
      const reach = COMMUTE + 12 * this.cov.transit[z.i] + 22 * this.cov.metro[z.i];   // buses and the metro stretch how far people will go
      this.hwNet[z.i] = hw ? 1 : 0; this.commute[z.i] = Math.min(255, best);
      const ok = best <= reach;
      if (k === T.RES) { this.jobReach[z.i] = ok || few ? 1 : 0; if (z.l && !this.jobReach[z.i]) noJobN++; }
      else { this.workReach[z.i] = ok || fewPeople ? 1 : 0; if (z.l && !this.workReach[z.i]) noWorkN++; }
      if (rs.length && !hw) offGrid++;
    }
    Object.assign(this.net, { noJobN, noWorkN, offGrid });
    this.analyzeSea();
  }
  // Which waterfront lots can send ships out to sea. Water reaching the map edge is open sea, and ships can't pass under bridges,
  // so the sea is flooded in from the edge over water without a bridge on it. Lots within 2 tiles of that water ship to the sea;
  // lots by water that only reaches the edge past a bridge are blocked (the Inspector and Advisors say so).
  // Connected parts of open water (no bridge on them), for ferries.
  labelWater() {
    const w = this.w, n = N * N, wc = this.waterComp || (this.waterComp = new Int32Array(n)), st = []; wc.fill(-1); let id = 0;
    const open = (q) => w.terrain[q] === TERRAIN.WATER && w.kind[q] !== T.ROAD;
    for (let s0 = 0; s0 < n; s0++) {
      if (wc[s0] >= 0 || !open(s0)) continue;
      wc[s0] = id; st.push(s0);
      while (st.length) { const c = st.pop(), x = c % N, y = (c / N) | 0; for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (!w.inb(xx, yy)) continue; const q = yy * N + xx; if (wc[q] < 0 && open(q)) { wc[q] = id; st.push(q); } } }
      id++;
    }
  }
  // Ferry piers on the same open water are linked: each one's count of other piers it can reach.
  linkFerries(anchors) {
    if (!this.waterComp) this.labelWater();
    const by = new Map(), at = []; this.ferryLinks = new Map();
    for (const a of anchors) { if (!a.def.ferry || this.closed(a.def)) continue; const [bx, by2] = berthTile(a.def, a.x, a.y, this.w.variant[a.i]); const c = this.w.inb(bx, by2) ? this.waterComp[by2 * N + bx] : -1; if (c < 0) continue; at.push([a.i, c]); by.set(c, (by.get(c) || 0) + 1); }
    for (const [i, c] of at) this.ferryLinks.set(i, by.get(c) - 1);
  }
  // Water tiles taken by shore buildings: 1 = under a pier, deck or pontoon, 2 = a berth kept clear for boats.
  decks() {
    const w = this.w, d = this._deck || (this._deck = new Uint8Array(N * N)); d.fill(0);
    for (let i = 0; i < N * N; i++) {
      if (w.kind[i] !== T.SVC || w.bo[i] !== 0) continue; const def = BT[w.bt[i]]; if (!def.reach) continue;
      for (const [xx, yy, r] of frontTiles(def, i % N, (i / N) | 0, w.variant[i], true)) if (w.inb(xx, yy)) d[yy * N + xx] = r < def.reach ? 1 : 2;
    }
    return d;
  }
  // Which way a shore building at (x, y) can face: the first side with open water in front (-1 if none).
  shoreFace(def, x, y) {
    const w = this.w, deck = this.decks();
    for (let face = 0; face < 4; face++) {
      let ok = true;
      for (const [xx, yy] of frontTiles(def, x, y, face, true)) { if (!w.inb(xx, yy)) { ok = false; break; } const q = w.idx(xx, yy); if (w.terrain[q] !== TERRAIN.WATER || w.kind[q] === T.ROAD || deck[q]) { ok = false; break; } }
      if (ok) return face;
    }
    return -1;
  }
  analyzeSea() {
    const w = this.w, n = N * N, open = new Uint8Array(n), edgeB = new Uint8Array(n), st = [];
    const water = (q) => w.terrain[q] === TERRAIN.WATER;
    const flood = (mark, ok) => {
      for (let i = 0; i < n; i++) { const x = i % N, y = (i / N) | 0; if ((x === 0 || y === 0 || x === N - 1 || y === N - 1) && ok(i) && !mark[i]) { mark[i] = 1; st.push(i); } }
      while (st.length) { const c = st.pop(), x = c % N, y = (c / N) | 0;
        for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (!w.inb(xx, yy)) continue; const q = yy * N + xx; if (!mark[q] && ok(q)) { mark[q] = 1; st.push(q); } } }
    };
    flood(open, (q) => water(q) && w.kind[q] !== T.ROAD);
    this.labelWater();
    flood(edgeB, water);
    const sl = this.seaLink; sl.fill(0);
    for (let i = 0; i < n; i++) {
      if (water(i) || !w.shore[i]) continue;
      const x = i % N, y = (i / N) | 0; let o = 0, e = 0;
      for (let j = -2; j <= 2 && !o; j++) for (let k = -2; k <= 2; k++) { const xx = x + k, yy = y + j; if (!w.inb(xx, yy)) continue; const q = yy * N + xx; if (open[q]) { o = 1; break; } if (edgeB[q]) e = 1; }
      sl[i] = o ? 1 : e ? 2 : 0;
    }
  }

  // What kind of industry grows on an empty lot: tech near schools in a university town, forestry by woods,
  // farms out in the open away from homes and shops; waterfront lots keep their harbor look.
  pickSpec(i) {
    const w = this.w; if (w.shore[i] >= 2) return 0;
    const x = i % N, y = (i / N) | 0; let trees = 0, town = 0;
    for (let j = -4; j <= 4; j++) for (let k = -4; k <= 4; k++) { const xx = x + k, yy = y + j; if (!w.inb(xx, yy)) continue; const q = yy * N + xx, kk = w.kind[q]; if (Math.abs(j) <= 3 && Math.abs(k) <= 3 && w.tree[q]) trees++; if (kk === T.RES || kk === T.COM) town++; }
    if (this.hasUni && this.cov.edu[i] >= 0.5) return 3;
    if (trees >= 6) return 2;
    if (town === 0) return 1;
    return 0;
  }
  zoneDemand(k) { return k === T.RES ? this.rd : k === T.COM ? this.cd : this.id; }
  // The single source of truth for "why isn't this growing": used by growth and by the inspector card.
  blocker(i, k, lvl) {
    const w = this.w, x = i % N, y = (i / N) | 0, d = this.zoneDemand(k);
    if (!w.roadNear(x, y, 2)) return 'No road within 2 tiles';
    if (!this.linkedOut(i)) return k === T.IND && this.seaLink[i] === 2 ? 'Its roads don\u2019t reach the highway, and a bridge blocks its ships from the sea' : 'Its roads don\u2019t reach the highway';
    if (!this.pw[i]) return 'No power';
    if (k === T.RES ? !this.jobReach[i] : !this.workReach[i]) return k === T.RES ? 'No jobs within commuting distance' : 'No workers live within commuting distance';
    if (lvl === 0) return d > -0.05 ? null : `Low demand for ${ZONE_NAME[k].toLowerCase()}`;
    if (lvl >= MAX_LEVEL) return null;
    if (!this.wt[i]) return 'No water';
    if (lvl >= 2 && !this.ts[i]) return 'Garbage isn\u2019t collected';
    if (lvl === 3 && !this.isUnlocked('sky')) return `Skyscrapers unlock at ${UNLOCK.sky.toLocaleString('en-US')} residents`;
    if (k === T.IND && ((w.variant[i] >> 4) & 3) === 3 && this.net.edu < 0.4) return 'Tech needs educated workers (schools and a university)';
    if (k !== T.RES && lvl === 2 && this.net.edu < 0.25) return 'Needs educated workers (build schools near homes)';
    if (k !== T.RES && lvl === 3 && (this.net.edu < 0.5 || !this.hasUni)) return 'Needs a university-educated workforce';
    if (k === T.RES && lvl === 3 && (this.cov.health[i] < 0.3 || this.cov.edu[i] < 0.3)) return 'Needs a hospital or clinic and schools nearby';
    const lv = Math.round(this.landValue(i, k)), need = LEVEL_LV[lvl];
    if (lv < need) return `Land value ${lv} (needs ${need})`;
    if (d <= 0.04) return `Low demand for ${ZONE_NAME[k].toLowerCase()}`;
    return null;
  }

  // ---- debt: what the city does when it owes the bank money ----
  cutLimit() { return Math.max(4000, Math.round(this.lastIncome * 1.5)); }
  updateCut(silent) {
    const m = this.money, T1 = this.cutLimit();
    const c = m >= 0 ? 0 : m > -T1 ? 1 : m > -3 * T1 ? 2 : 3;
    if (c === this.cut) return;
    const was = this.cut; this.cut = c; this.needAn = true;
    if (silent) return;
    if (c > was) {
      const groups = Object.keys(CUT_STAGE).filter((g) => CUT_STAGE[g] > was && CUT_STAGE[g] <= c).map((g) => CUT_NAMES[g]);
      this.pushNews(was === 0 ? `City is in debt to the bank. Ordinances suspended and ${groups.join(', ')} closed to save money` : `Debt deepens: ${groups.join(', ')} shut down`);
      this.events.push({ type: 'cut', stage: c });
    } else this.pushNews(c === 0 ? 'Debt cleared. All services reopen' : 'Debt shrinking: some services reopen');
  }
  closedList() { return Object.keys(CUT_STAGE).filter((g) => this.cut >= CUT_STAGE[g]).map((g) => CUT_NAMES[g]); }
  owed() { return this.loans.reduce((a, l) => a + l.pay * l.left, 0) + Math.max(0, -this.money); }
  creditLimit() { return Math.max(0, Math.max(15000, this.pop * 20 + this.lastIncome * 6) - this.loans.reduce((a, l) => a + l.pay * l.left, 0)); }
  loanOffers() { return LOANS.map((o, k) => ({ k, ...o, pay: Math.round((o.amount * (1 + o.rate)) / o.months), ok: this.loans.length < 3 && o.amount <= this.creditLimit() })); }
  takeLoan(k) {
    const o = this.loanOffers()[k];
    if (!o) return { ok: false };
    if (this.loans.length >= 3) return { ok: false, why: 'The bank allows 3 loans at once' };
    if (!o.ok) return { ok: false, why: 'The bank won\u2019t lend that much yet. Grow the city or repay a loan' };
    this.loans.push({ amount: o.amount, pay: o.pay, left: o.months });
    this.money += o.amount; this.updateCut();
    this.pushNews(`City borrows ${fmt$(o.amount)} from the regional bank`);
    return { ok: true };
  }
  repayLoan(k) {
    const l = this.loans[k]; if (!l) return { ok: false };
    const due = Math.round(l.pay * l.left * 0.9);         // paying early saves 10% of the remaining payments
    if (this.money < due) return { ok: false, why: `Repaying needs ${fmt$(due)}` };
    this.money -= due; this.loans.splice(k, 1); this.pushNews('City pays off a bank loan early');
    return { ok: true, cost: due };
  }

  // ---- growth ----
  tick() {
    this.day++;
    if ((this.needAn && this.day - (this.lastAn ?? -9) >= 2) || this.day - (this.lastAn ?? -9) >= 8) { this.startAnalyze(); this.lastAn = this.day; }   // growth is batched instead of recalculating every day
    const w = this.w, rnd = this.rnd, h = this.happiness;
    for (let n = 0; n < 150; n++) {
      const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N), i = w.idx(x, y);
      const z = w.kind[i];
      if (z !== T.RES && z !== T.COM && z !== T.IND) continue;
      if (this.pending.has(i)) continue;
      const d = this.zoneDemand(z), lvl = w.level[i];
      const road = w.roadNear(x, y, 2);
      if (!road) { if (lvl && rnd() < 0.03) { w.level[i] = lvl - 1; if (z === T.RES) this.events.push({ type: 'moveOut', i, n: POP_CAP[lvl] - POP_CAP[lvl - 1] }); } continue; }
      const grow = (to) => { const pv = w.variant[i], sp = z === T.IND ? (lvl === 0 ? this.pickSpec(i) : (pv >> 4) & 3) : 0; w.level[i] = to; w.variant[i] = Math.floor(rnd() * 8) | (sp << 4); this.needAn = true; this.markBuilt(i, { kind: z, from: lvl, to, pv }); };   // 8 looks per building (4..7 add roof and street details)
      const shrink = () => { w.level[i] = lvl - 1; this.needAn = true; if (z === T.RES) this.events.push({ type: 'moveOut', i, n: POP_CAP[lvl] - POP_CAP[lvl - 1] }); };
      if (lvl === 0) {
        if (!this.blocker(i, z, 0) && rnd() < 0.15 + 0.5 * Math.max(0, d)) grow(1);
        continue;
      }
      if (this.day <= this.grace) { /* older saves get time to adapt */ }
      else if (!this.pw[i] && rnd() < 0.02) { shrink(); continue; }
      else if (!this.linkedOut(i) && rnd() < 0.012) { shrink(); continue; }                       // cut off from the region
      else if ((z === T.RES ? !this.jobReach[i] : !this.workReach[i]) && rnd() < 0.012) { shrink(); continue; }   // people move closer to work
      if (z === T.RES && h < 35 && rnd() < ((35 - h) / 35) * 0.04) { shrink(); continue; }      // unhappy residents leave
      if (lvl < MAX_LEVEL) {
        if (!this.blocker(i, z, lvl) && rnd() < 0.1 * d + 0.02 + (z === T.RES ? Math.max(0, h - 60) / 400 : 0)) grow(lvl + 1);
        else if (d < -0.25 && rnd() < 0.06) shrink();
      } else if (d < -0.25 && rnd() < 0.06) shrink();
      if (lvl === 1 && d < -0.35 && rnd() < 0.05) { w.level[i] = 0; this.needAn = true; if (z === T.RES) this.events.push({ type: 'moveOut', i, n: POP_CAP[1] }); }
    }
    this.recount();
    this.updateCut();
    if (this.pop > this.peakPop) {
      this.peakPop = this.pop;
      for (const k in UNLOCK) if (this.peakPop >= UNLOCK[k] && !this.unlocked.has(k)) {
        this.unlocked.add(k); const name = (BY_KEY[k] && BY_KEY[k].name) || UNLOCK_NAME[k];
        this.events.push({ type: 'unlock', key: k, name }); this.pushNews(`${name} now available`);
      }
    }
    if (this.day % 5 === 0) this.checkGoals();
    if (this.day % 30 === 0) this.monthly();
  }
  checkTutorial() { while (this.tut < TUTORIAL.length && TUTORIAL[this.tut].done(this)) { this.tut++; this.events.push({ type: 'tut', step: this.tut }); } }
  skipTutorial() { this.tut = TUTORIAL.length; }

  monthly() {
    const n = this.net, served = 0.5 + 0.5 * (1 - n.unserved);
    const mood = 0.8 + this.happiness / 250;              // happy residents pay willingly (0.8 to 1.2)
    const health = 0.85 + 0.15 * n.health;                 // healthy workers are more productive
    const exportK = this.hwRoads > 0 || this.ports > 0 ? 1 : 0.5;   // without the highway or a sea port, industry can't sell its goods
    this.grant = Math.round(Math.max(0, 300 * (1 - this.pop / 1200)));       // regional grant that tapers off as the town grows
    this.tourIncome = Math.round(this.tourists * 3 * (0.6 + this.tax.c / 22));                                   // visitors pay for rooms, meals and tickets
    const inc = (this.pop * (this.tax.r / 100) * 22 * mood + this.cJobs * (this.tax.c / 100) * 22 * health + (this.iTax ?? this.iJobs) * (this.tax.i / 100) * 22 * health * exportK) * served + this.grant + this.tourIncome;
    let wires = 0; for (let i = 0; i < N * N; i++) if (this.w.wire[i]) wires += this.w.wire[i] === 2 ? 0.3 : 0.15;
    let pipes = 0; for (let i = 0; i < N * N; i++) if (this.w.pipe[i]) pipes += 0.1;
    let loanPay = 0;
    for (const l of this.loans) { loanPay += l.pay; l.left--; }
    this.loans = this.loans.filter((l) => l.left > 0);
    const interest = this.money < 0 ? Math.round(-this.money * OVERDRAFT_RATE) : 0;
    const exp = this.roads * 0.4 + (this.avenues || 0) * 0.6 + (this.bridges || 0) * 1.6 + this.parks * 1 + n.upkeep + wires + pipes + this.ordCost();
    this.lastIncome = Math.round(inc); this.lastExpense = Math.round(exp); this.lastLoanPay = loanPay; this.lastInterest = interest;
    const net = this.lastIncome - this.lastExpense - loanPay - interest;
    this.money += net;
    this.streak = net > 0 ? this.streak + 1 : 0;
    this.history.push({ d: this.day, pop: this.pop, money: Math.round(this.money), happy: this.happiness, inc: this.lastIncome, exp: this.lastExpense + loanPay + interest });
    if (this.history.length > 240) this.history.shift();
    this.updateCut();
    this.events.push({ type: 'month', income: this.lastIncome, expense: this.lastExpense + loanPay + interest });
    this.monthlyRequests();
    this.headline();
  }
  headline() {
    const bad = this.advice.filter((a) => a.sev !== 'tip');
    if (bad.length && this.rnd() < 0.55) { const a = bad[Math.floor(this.rnd() * Math.min(3, bad.length))]; if (a.news) this.pushNews(a.news); return; }
    const p = this.pop, h = this.happiness, pick = (arr) => arr[Math.floor(this.rnd() * arr.length)];
    const good = [];
    if (h >= 70) good.push('Survey: residents rate the city a great place to live', 'Young families are moving in');
    if (this.bld.top) good.push('Skyline draws photographers to the waterfront');
    if (this.ports) good.push('Cargo ships crowd the harbor', 'Record month for goods shipped by sea');
    if (this.net.transit > 0.4) good.push('Bus ridership hits a record high');
    if (this.lastIncome > this.lastExpense * 1.3) good.push('City budget posts a healthy surplus');
    if (this.parks > 10) good.push('Weekend crowds pack the city parks');
    if (p < 200) good.push('Small town, big plans: new arrivals settle in', 'Local diner becomes the town\u2019s meeting place');
    good.push('Quiet month at city hall', 'Local team wins the regional cup', 'Farmers market returns to the square');
    if (this.rnd() < 0.7) this.pushNews(pick(good));
  }

  // ---- advisors: plain-language problems, worst first ----
  makeAdvice() {
    const n = this.net, out = [], add = (who, sev, text, view, news) => out.push({ who, sev, text, view, news });
    const avgTax = (this.tax.r + this.tax.c + this.tax.i) / 3, jobs = this.cJobs + this.iJobs;
    if (this.cut) add('Finance', 'bad', `The city owes the bank ${fmt$(-this.money)}. Closed to save money: ${this.closedList().join(', ')}. Services reopen once the balance is positive again.`, null, 'Residents protest closed services as the city struggles with debt');
    else if (this.lastIncome && this.lastIncome < this.lastExpense + this.lastLoanPay) add('Finance', 'warn', `Last month cost ${fmt$(this.lastExpense + this.lastLoanPay - this.lastIncome)} more than it earned. Raise taxes a little, drop ordinances, or take a loan to cover the gap.`, null, 'City budget slips into the red');
    if (avgTax >= 13) add('Finance', 'warn', 'Taxes are high. Residents are less happy and fewer people move in.', null, 'Residents grumble about high taxes');
    if (this.hwRoads === 0) add('Planning', 'bad', 'Nothing can grow until your roads connect to the highway at the edge of the map.', 'commute');
    else if (n.offGrid > 3) add('Planning', 'warn', `${n.offGrid} zoned lots are on roads that don\u2019t reach the highway. Connect them to the main road network.`, 'commute');
    { const sn = this.SEASON_NOW; if (sn === 3 && n.pDem > n.pSup * 0.9) add('Utilities', 'warn', 'Winter heating has raised power demand by a quarter. Build more power before the lights go out.', 'power', 'Cold snap strains the power grid'); }
    if (this.attraction > this.beds + 20 && this.pop >= 200) add('Tourism', 'tip', `Visitors want to come (${this.attraction} a month) but there are only ${this.beds} hotel beds. Shops at level 3, or waterfront shops at level 2, add hotels.`);
    if (this.portsBlocked) add('Transport', 'warn', `${this.portsBlocked} harbor${this.portsBlocked > 1 ? 's' : ''} can\u2019t send ships to the sea: a bridge blocks the way. Ships can\u2019t pass under bridges, so remove it or route the road another way.`, null, 'Bridge traps cargo ships in the harbor');
    if (this.ferryLinks) { let lone = 0; for (const v of this.ferryLinks.values()) if (!v) lone++; if (lone) add('Transport', 'tip', `${lone === 1 ? 'A ferry pier has' : lone + ' ferry piers have'} no ferry yet. Build a second ferry pier across the same water to start a route.`, 'transit'); }
    if (n.noJobN > 2) add('Planning', 'warn', `${n.noJobN} homes have no jobs within commuting distance. Zone shops or industry closer, or add bus stops to stretch commutes.`, 'commute', 'Long commutes drive residents out of the suburbs');
    if (n.noWorkN > 2) add('Planning', 'warn', `${n.noWorkN} workplaces can\u2019t find workers nearby. Zone homes closer to them.`, 'commute');
    if (n.pDem > n.pSup) add('Utilities', 'bad', `Power demand is ${n.pDem} but plants make ${n.pSup}. Build another plant.`, 'power', 'Brownouts hit the city as power runs short');
    else if (n.unserved > 0.08) add('Utilities', 'warn', `${Math.round(n.unserved * 100)}% of buildings have no power. The power view shows the gaps.`, 'power');
    if (n.wDem > n.wSup) add('Utilities', 'bad', `Water demand is ${n.wDem} but supply is ${n.wSup}. Add a water source and pipes.`, 'water', 'Taps run dry in parts of the city');
    if (n.wasteUn > 0.15) add('Utilities', 'warn', `Garbage isn\u2019t collected from ${Math.round(n.wasteUn * 100)}% of buildings. Build a landfill or recycling center in range.`, 'waste', 'Garbage piles up on city streets');
    if (n.jamAvg > 0.2) add('Transport', 'warn', 'Traffic jams are slowing commutes and lowering land value. Add bus stops and a terminal, or build a second route.', 'traffic', 'Rush hour gridlock frustrates commuters');
    if (n.crimeAvg > 28 && this.pop > 200) add('Safety', 'warn', 'Crime is rising in busy neighborhoods. Build police stations near homes.', 'crime', 'Break-ins rise downtown');
    if (n.fire < 0.3 && this.pop > 300) add('Safety', 'tip', 'Much of the city has no fire station in range. Fires there spread fast.', 'fire');
    if (n.pollAvg > 22) add('Health', 'warn', 'Pollution is hurting residents. Keep industry away from homes and plant parks between them.', 'pollution', 'Smog alert: residents told to stay indoors');
    if (n.health < 0.35 && this.pop > 300) add('Health', 'warn', 'Few residents have a clinic or hospital nearby. Sick workers mean less tax income.', 'health');
    const offices = this.w.level.some((l, i) => l === 2 && (this.w.kind[i] === T.COM || this.w.kind[i] === T.IND));
    if (offices && n.edu < 0.25) add('Education', 'warn', 'Offices and factories can\u2019t grow without educated workers. Build schools near homes.', 'edu');
    if (this.isUnlocked('sky') && !this.hasUni) add('Education', 'tip', 'Office megatowers and hi-tech campuses need a university.', 'edu');
    if (this.happiness < 45) { const worst = this.hapParts.find((p) => p[1] < 0); add('People', 'bad', `Residents are unhappy (${this.happiness}%)${worst ? `. Biggest complaint: ${worst[0].toLowerCase()}` : ''}. Unhappy residents move away.`, null, 'Families pack up and leave town'); }
    if (this.rd > 0.5) add('Planning', 'tip', 'People want to move here. Zone more homes.');
    if (this.cd > 0.5) add('Planning', 'tip', 'Shops are in demand. Zone more commercial.');
    if (this.id > 0.5) add('Planning', 'tip', 'Industry wants to expand. Zone more industrial land.');
    const rank = { bad: 0, warn: 1, tip: 2 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev]).slice(0, 10);
  }

  // ---- inspector card ----
  inspect(x, y) {
    const w = this.w; if (!w.inb(x, y)) return null;
    const i = w.idx(x, y), k = w.kind[i], lvRaw = Math.round(this.lv[i]);
    const row = (label, value, ok) => ({ label, value, ok });
    const yes = (b) => (b ? 'Yes' : 'No');
    if (w.terrain[i] === TERRAIN.WATER && k !== T.ROAD) return { x, y, w: 1, d: 1, title: 'Water', sub: 'Drag a road from the shore to build a bridge', rows: [] };
    if (k === T.ROAD) {
      const tr = this.traffic ? this.traffic[i] : 0, hw = this.roadLinked(i);
      const br = w.terrain[i] === TERRAIN.WATER;
      const av = !br && w.level[i] === 1;
      return { x, y, w: 1, d: 1, title: w.hw[i] ? 'Highway' : br ? 'Bridge' : av ? 'Avenue' : 'Road', sub: w.hw[i] ? 'Links the city to the region' : br ? 'Upkeep $2/month' : av ? 'Carries twice the traffic of a street. Upkeep $1/month' : 'Upkeep $0.40/month. Pick Avenue and drag over it to widen it',
        rows: [row('Traffic', tr > 1.3 ? 'Jammed' : tr > 0.7 ? 'Busy' : 'Light', tr <= 1.3), row('Reaches the highway', yes(hw), hw)] };
    }
    if (k === T.SVC) {
      const ax = x - (w.bo[i] & 3), ay = y - (w.bo[i] >> 2), a = w.idx(ax, ay), def = BT[w.bt[i]], shut = this.closed(def), building = this.pending.has(a);
      const rows = [];
      rows.push(row('Status', building ? 'Under construction' : shut ? 'Closed (city in debt)' : 'Open', !building && !shut));
      if (def.use || def.cov) rows.push(row('Power', def.power ? 'Generates' : yes(this.pw[a]), def.power || !!this.pw[a]));
      rows.push(row('Upkeep', fmt$(def.upkeep * (shut ? 0.2 : 1)) + '/month'));
      if (def.power) rows.push(row('Power output', def.power));
      if (def.water) rows.push(row('Water output', def.water + (def.use && !this.pw[a] ? ' (30% without power)' : '')));
      if (def.waste) rows.push(row('Garbage capacity', def.waste));
      if (def.cov) rows.push(row('Serves', `${def.radius} tiles around`));
      if (def.ferry && !building && !shut) { const nf = (this.ferryLinks && this.ferryLinks.get(a)) || 0; rows.push(row('Ferry route', nf ? `Yes, to ${nf} other pier${nf > 1 ? 's' : ''}` : 'No, needs a second ferry pier on the same water', nf > 0)); }
      if (def.pollute) rows.push(row('Pollution', 'Yes', false));
      return { x: ax, y: ay, w: def.w, d: def.d, title: def.name, sub: shut ? 'Reopens when the city is out of debt' : '', rows, why: shut ? 'Closed to save money while the city owes the bank' : null };
    }
    if (k === T.PARK) return { x, y, w: 1, d: 1, title: 'Park', sub: 'Raises land value and happiness nearby, cleans the air', rows: [row('Land value', lvRaw)] };
    if (k === T.RES || k === T.COM || k === T.IND) {
      const l = this.lvl(i), building = this.pending.has(i), res = k === T.RES, cap = res ? POP_CAP[l] : (k === T.COM ? COM_CAP[l] : IND_CAP[l]);
      const lv = Math.round(this.landValue(i, k)), reach = res ? this.jobReach[i] : this.workReach[i], c = this.commute[i];
      const rows = [
        row('Power', yes(this.pw[i]), !!this.pw[i]),
        row('Water', yes(this.wt[i]), !!this.wt[i]),
        row('Garbage collected', l < 2 && !this.ts[i] ? 'Not needed yet' : yes(this.ts[i]), l < 2 && !this.ts[i] ? null : !!this.ts[i]),
        row('Reaches the highway', yes(this.hwNet[i]), !!this.hwNet[i]),
        row(res ? 'Jobs within reach' : 'Workers within reach', reach ? (c < 1 ? 'Yes, right nearby' : c < 255 ? `Yes, ${Math.round(c)} tiles away` : 'Yes') : 'No', !!reach),
        row('Land value', l < MAX_LEVEL ? `${lv} / ${LEVEL_LV[Math.max(1, l)]}` : lv, l >= MAX_LEVEL || lv >= LEVEL_LV[Math.max(1, l)]),
        row('Demand', this.zoneDemand(k) > 0.04 ? 'High' : this.zoneDemand(k) > -0.05 ? 'Steady' : 'Low', this.zoneDemand(k) > -0.05),
        row('Crime', Math.round(this.crime[i]), this.crime[i] < 30),
        row('Pollution', Math.round(this.poll[i]), this.poll[i] < 25),
        row('Traffic nearby', this.jam[i] > 0.5 ? 'Jammed' : this.jam[i] > 0.15 ? 'Busy' : 'Light', this.jam[i] <= 0.5),
      ];
      const why = building ? 'Under construction' : this.blocker(i, k, l);
      const shr = w.shore[i], wf = shr ? `Waterfront (${SHORE_NAME[shr].toLowerCase()})` : '';
      if (shr) rows.splice(5, 0, row('Waterfront', `${SHORE_NAME[shr]}, +${WF_LV[shr]} land value`, true));
      if (k === T.IND && shr >= 2) { const sl = this.seaLink[i]; rows.splice(6, 0, row('Ships to the sea', sl === 1 ? 'Yes, goods ship out by sea' : sl === 2 ? 'No, a bridge blocks the way' : 'No, inland water (barges only)', sl === 1 ? true : sl === 2 ? false : null)); }
      const spc = specOf(w, i);
      if (spc) rows.splice(0, 0, row('Industry type', ['', 'Farm: few jobs, little pollution', 'Forestry: some pollution', 'Tech: many jobs, clean, high tax'][spc], true));
      const title = l ? (spc ? SPEC_TITLE[spc][l] : shr ? WF_NAME[shr][k][l] : LEVEL_NAME[k][l]) : `${ZONE_NAME[k]} zone (empty lot)`;
      const sub = l ? `${wf ? wf + '  \u00b7  ' : ''}Level ${l} of ${MAX_LEVEL}  \u00b7  ${cap} ${res ? 'residents' : 'jobs'}` : wf ? `${wf}: waiting for someone to build here` : 'Waiting for someone to build here';
      return { x, y, w: 1, d: 1, title, sub, rows, why: why || (l >= MAX_LEVEL ? 'Fully grown' : l ? 'Ready to grow' : 'Ready to build'), good: !why };
    }
    const shrO = w.shore[i];
    return { x, y, w: 1, d: 1, title: w.tree[i] ? 'Woods' : 'Open land', sub: shrO ? `Waterfront (${SHORE_NAME[shrO].toLowerCase()}): free to build` : 'Free to build', rows: [row('Land value', lvRaw, lvRaw >= 46), row('Pollution', Math.round(this.poll[i]), this.poll[i] < 25), row('Crime', Math.round(this.crime[i]), this.crime[i] < 30)] };
  }
  roadLinked(i) { const c = this.roadComp[i]; return c >= 0 && !!this.hwRoadComp && this.hwRoadComp.has(c); }

  // ---- player actions ----
  spend(c, force) { if (!force && this.money < c) return false; this.money -= c; return true; }
  noMoney() { return this.money < 0 ? 'The city is in debt. Nothing new can be built' : 'Not enough money'; }
  canPlaceBuilding(key, x, y) {
    const def = BY_KEY[key], w = this.w;
    if (!this.isUnlocked(key)) return { ok: false, why: `${def.name} unlocks at ${UNLOCK[key].toLocaleString('en-US')} residents` };
    if (def.road) {                                   // bus stops and terminals must sit beside a road
      let ok = false;
      for (let yy = y - 1; yy <= y + def.d && !ok; yy++) for (let xx = x - 1; xx <= x + def.w; xx++) if (w.isRoad(xx, yy)) { ok = true; break; }
      if (!ok) return { ok: false, why: 'Must be next to a road' };
    }
    for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) {
      const xx = x + dx, yy = y + dy;
      if (!w.inb(xx, yy)) return { ok: false, why: 'Out of bounds' };
      const i = w.idx(xx, yy), k = w.kind[i];
      if (w.terrain[i] === TERRAIN.WATER) return { ok: false, why: 'Can\u2019t build on water' };
      if (!(k === T.EMPTY || (ZK[k] && w.level[i] === 0))) return { ok: false, why: 'Tiles must be clear' };
      if (def.shore === 'sand' && w.terrain[i] !== TERRAIN.SAND) return { ok: false, why: 'Beaches go on sand, right by the water' };
    }
    if (def.shore) {
      let near = 0; for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) near = Math.max(near, w.shore[w.idx(x + dx, y + dy)]);
      if (!near) return { ok: false, why: 'Must be built on the shore' };
      if (def.shore === 'lake' && near < 2) return { ok: false, why: `${def.name}s need a lake or the sea, not a pond` };
      const face = this.shoreFace(def, x, y);
      if (face < 0) return { ok: false, why: def.dock ? `Must be on the shore, with ${def.reach + 1} rows of open water in front (no bridges)` : `Must be on the shore, with ${def.reach} row${def.reach > 1 ? 's' : ''} of open water in front (no bridges)` };
      return { ok: true, face };
    }
    return { ok: true };
  }
  placeBuilding(key, x, y) {
    this.roadsDirty = true;
    const def = BY_KEY[key], w = this.w, c = this.canPlaceBuilding(key, x, y);
    if (!c.ok) return c;
    if (!this.spend(def.cost)) return { ok: false, why: this.money < 0 ? 'The city is in debt. Nothing new can be built' : 'Not enough money' };
    for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) {
      const i = w.idx(x + dx, y + dy);
      w.kind[i] = T.SVC; w.bt[i] = def.id; w.bo[i] = dx | (dy << 2); w.level[i] = 0; w.tree[i] = 0;
      if (def.shore) w.variant[i] = c.face;       // which side the water is on
      if (w.wire[i] === 1) w.wire[i] = 0;      // overhead lines are cleared, buried cable stays
    }
    this.markBuilt(w.idx(x, y), { bt: def.id, from: 0, to: 1 });
    this.recount(); this.analyze();
    return { ok: true, cost: def.cost };
  }
  isBridge(x, y) { const w = this.w; return w.inb(x, y) && w.kind[w.idx(x, y)] === T.ROAD && w.terrain[w.idx(x, y)] === TERRAIN.WATER; }
  // A bridge runs along x or y: the direction it has road on either end.
  bridgeAxis(x, y) { const w = this.w; return w.isRoad(x - 1, y) || w.isRoad(x + 1, y) ? 'x' : w.isRoad(x, y - 1) || w.isRoad(x, y + 1) ? 'y' : null; }
  // Bridges start from a road, run straight, have no junctions on the water and are at most BRIDGE_MAX tiles long.
  placeBridge(x, y) {
    const w = this.w, i = w.idx(x, y);
    if (w.kind[i] === T.ROAD) return { ok: false };
    const ax = w.isRoad(x - 1, y) || w.isRoad(x + 1, y), ay = w.isRoad(x, y - 1) || w.isRoad(x, y + 1);
    if (!ax && !ay) return { ok: false, why: 'Bridges must start from a road on the shore' };
    if (this.decks()[i]) return { ok: false, why: 'A pier, beach or marina uses this water' };
    if (ax && ay) return { ok: false, why: 'Bridges run in a straight line, with no junctions on the water' };
    const dx = ax ? 1 : 0, dy = ax ? 0 : 1;
    for (const s of [1, -1]) {                               // the road it joins must run the same way
      const xx = x + dx * s, yy = y + dy * s;
      if (this.isBridge(xx, yy) && this.bridgeAxis(xx, yy) !== (ax ? 'x' : 'y')) return { ok: false, why: 'Bridges run in a straight line, with no junctions on the water' };
    }
    let len = 1;
    for (const s of [1, -1]) for (let n = 1; this.isBridge(x + dx * s * n, y + dy * s * n); n++) len++;
    if (len > BRIDGE_MAX) return { ok: false, why: `Bridges can be at most ${BRIDGE_MAX} tiles long` };
    if (!this.spend(COST.bridge)) return { ok: false, why: this.noMoney() };
    w.kind[i] = T.ROAD; w.level[i] = 0; w.tree[i] = 0;
    this.needAn = true; this.recount();
    return { ok: true, cost: COST.bridge, bridge: true };
  }
  place(tool, x, y) {
    const w = this.w; this.roadsDirty = true;
    if (!w.inb(x, y)) return { ok: false };
    const i = w.idx(x, y), k = w.kind[i];
    if (w.terrain[i] === TERRAIN.WATER) {                   // only bridges, and the lines and pipes they carry, go on water
      if (tool === 'road') return this.placeBridge(x, y);
      const onBridge = k === T.ROAD && (tool === 'bulldoze' || tool === 'wire' || tool === 'cable' || tool === 'pipe');
      if (!onBridge) return { ok: false, why: 'Can\u2019t build on water' };
    }
    if (tool === 'bulldoze') {
      if (w.hw[i]) return { ok: false, why: 'The highway links your city to the region and can\u2019t be removed' };
      if (k === T.SVC) {
        const def = BT[w.bt[i]], ax = x - (w.bo[i] & 3), ay = y - (w.bo[i] >> 2), cost = COST.bulldoze * 5;
        this.spend(cost, true);
        this.pending.delete(w.idx(ax, ay));
        for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) { const q = w.idx(ax + dx, ay + dy); w.kind[q] = T.EMPTY; w.bt[q] = 0; w.bo[q] = 0; }
        this.needAn = true; this.recount(); return { ok: true, cost };
      }
      if (k !== T.EMPTY) {
        this.spend(COST.bulldoze, true);
        this.pending.delete(i);
        if (k === T.RES && w.level[i]) this.events.push({ type: 'moveOut', i, n: POP_CAP[w.level[i]] });   // the residents drive away
        if (w.terrain[i] === TERRAIN.WATER) { w.wire[i] = 0; w.pipe[i] = 0; }      // lines and pipes go with the bridge
        w.kind[i] = T.EMPTY; w.level[i] = 0; w.tree[i] = 0; this.needAn = true; this.recount(); return { ok: true, cost: COST.bulldoze };
      }
      if (w.tree[i]) { w.tree[i] = 0; return { ok: true, cost: 0 }; }
      if (w.wire[i]) { this.spend(1, true); w.wire[i] = 0; this.needAn = true; return { ok: true, cost: 1 }; }
      if (w.pipe[i]) { this.spend(1, true); w.pipe[i] = 0; this.needAn = true; return { ok: true, cost: 1 }; }
      return { ok: false };
    }
    if (tool === 'pipe') {
      if (w.pipe[i]) return { ok: false };
      if (!this.spend(COST.pipe)) return { ok: false, why: this.noMoney() };
      w.pipe[i] = 1; this.needAn = true; return { ok: true, cost: COST.pipe };
    }
    if (tool === 'wire' || tool === 'cable') {
      const want = tool === 'wire' ? 1 : 2, cost = COST[tool];
      if (w.wire[i] === want) return { ok: false };
      if (w.wire[i] === 2 && want === 1) return { ok: false };
      if (want === 1 && !(k === T.EMPTY || k === T.ROAD || k === T.PARK)) return { ok: false, why: 'Overhead lines need open ground. Use cable' };
      if (!this.spend(cost)) return { ok: false, why: this.noMoney() };
      w.wire[i] = want; w.tree[i] = 0; this.needAn = true;
      return { ok: true, cost };
    }
    if (tool === 'avenue') {                                        // a wider road: build new, or widen an existing street
      if (w.terrain[i] === TERRAIN.WATER) return { ok: false, why: 'Avenues can\u2019t cross water. Use a road for the bridge' };
      if (w.hw[i]) return { ok: false };
      if (k === T.ROAD) { if (w.level[i] === 1) return { ok: false }; if (!this.spend(COST.avenue - COST.road)) return { ok: false, why: this.noMoney() }; w.level[i] = 1; this.needAn = true; this.recount(); return { ok: true, cost: COST.avenue - COST.road }; }
      const r = this.place('road', x, y); if (r.ok) { if (!this.spend(COST.avenue - COST.road)) { return r; } w.level[i] = 1; this.recount(); return { ok: true, cost: COST.avenue }; } return r;
    }
    const map = { road: T.ROAD, res: T.RES, com: T.COM, ind: T.IND, park: T.PARK };
    const nk = map[tool];
    const cost = tool === 'road' ? COST.road : tool === 'park' ? COST.park : COST.zone;
    if (k === nk) return { ok: false };
    if (k === T.SVC) return { ok: false, why: 'Bulldoze the building first' };
    if (k === T.ROAD) return { ok: false, why: 'Bulldoze the road first' };
    if (w.level[i] > 0) return { ok: false, why: 'Bulldoze the building first' };
    if (nk === T.ROAD) for (const [dx, dy] of D4) {          // no side roads off a bridge
      const xx = x + dx, yy = y + dy;
      if (w.inb(xx, yy) && this.isBridge(xx, yy) && this.bridgeAxis(xx, yy) !== (dx ? 'x' : 'y')) return { ok: false, why: 'Roads can\u2019t join a bridge from the side' };
    }
    if (!this.spend(cost)) return { ok: false, why: this.noMoney() };
    w.kind[i] = nk; w.level[i] = 0; w.tree[i] = 0; w.variant[i] = Math.floor(this.rnd() * 4);
    if (w.wire[i] === 1 && (nk === T.RES || nk === T.COM || nk === T.IND)) w.wire[i] = 0;
    if (nk === T.PARK) this.markBuilt(i, { kind: T.PARK, from: 0, to: 1 });
    this.needAn = true; this.recount();
    return { ok: true, cost };
  }
}
