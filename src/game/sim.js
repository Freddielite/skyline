import { T, N, TERRAIN, SHORE_NAME } from './world.js';
import { WF_NAME } from './waterfront.js';
import { clamp, mulberry32, hash } from './util.js';
import { Flow, DISTRICT, DISTRICTS } from './flow.js';
import { junctionType, greenShare, defaultJunction, SIGNAL, PRI_V, PRI_H, CYCLE } from './traffic.js';
import { BT, BY_KEY, ELEC, WATER, WASTE, CUT_STAGE, cutGroup, frontTiles, berthTile } from './buildings.js';
import { buildMetro, metroCommutes, metroNeed, canLink, serving, metroPlan, TUNNEL_UPKEEP, LINE_COLS, WALK_R } from './metro.js';
import { roadDay, repairNow, repairNowCost, REPAIR_AT, BIG_AT } from './roads.js';
import { ORD, GOALS, UNLOCK, UNLOCK_NAME, LOANS, OVERDRAFT_RATE, TUTORIAL } from './rules.js';

export const COST = { avenue: 25, road: 10, bridge: 60, zone: 5, park: 25, bulldoze: 2, wire: 4, cable: 12, pipe: 6 };
export const BRIDGE_MAX = 12;                       // longest bridge, in tiles
export const POP_CAP = [0, 8, 24, 70, 160];
export const COM_CAP = [0, 5, 14, 40, 95];
export const IND_CAP = [0, 8, 18, 42, 70];
export const MAX_LEVEL = 4;
export const TRACK_MAX = 2;                        // lots reached only by a dirt track grow to this level (0.7.4)
export const LEVEL_LV = [0, 46, 62, 78];           // land value a building needs to grow from level n to n + 1
const IND_POLL = [0, 7, 14, 21, 8];
const WF_LV = [0, 4, 6, 8];                          // land value bonus near a pond, a lake, the sea                 // hi-tech campuses pollute far less than heavy plants
// Which way on the screen (north = up) a point lies from another, in tiles of the map. '' when it is close by.
function compass(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, SX = (dx - dy) * 2, SY = dx + dy;               // screen offsets (tiles are twice as wide as tall)
  if (Math.hypot(dx, dy) < 3) return '';
  const a = Math.atan2(SY, SX), k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][k];
}
export const LEVEL_NAME = {
  [T.RES]: ['Empty lot', 'House', 'Apartments', 'Residential tower', 'Skyscraper'],
  [T.COM]: ['Empty lot', 'Shop', 'Offices', 'Glass tower', 'Office megatower'],
  [T.IND]: ['Empty lot', 'Warehouse', 'Factory', 'Heavy plant', 'Hi-tech campus'],
};
export const ZONE_NAME = { [T.RES]: 'Homes', [T.COM]: 'Shops', [T.IND]: 'Industry' };
const COMMUTE = 18;
const METRO_EXTRA = 14;                              // how much longer a commute people accept when it is by metro (0.8.12)                                  // road tiles people will travel to work (more with transit)
const CUT_NAMES = { fun: 'amenities', edu: 'schools', transit: 'buses', safety: 'police, fire and health care' };
const fmt$ = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ZK = { [T.RES]: 'r', [T.COM]: 'c', [T.IND]: 'i' };
const COVS = ['police', 'fire', 'health', 'edu', 'fun', 'transit', 'metro'];
// ---- 0.8.6: people, goods, service budgets, elections and the region ----
export const FUND_GROUPS = ['police', 'fire', 'health', 'edu', 'transit', 'fun', 'roads'];
export const FUND_NAME = { police: 'Police', fire: 'Fire', health: 'Health care', edu: 'Schools', transit: 'Transit', fun: 'Parks & fun', roads: 'Road repairs' };
// which budget a service building is paid from: its first kind of coverage (the metro counts as transit)
export function fundGroup(def) { if (!def || !def.cov) return null; const k = def.cov[0][0]; return k === 'metro' ? 'transit' : k; }
export const WORK_SHARE = 0.6;                     // working residents per resident (matches the job demand in recount)
export const ABANDON_WHY = ['', 'no power', 'cut off from the highway', 'no jobs or workers within reach', 'unhappy residents', 'low demand'];
export const WEALTH_NAME = ['Working class', 'Middle class', 'Well-off'];
const WEALTH_TAX = [0.8, 1, 1.4];
export const wealthOf = (lv) => (lv < 50 ? 0 : lv < 68 ? 1 : 2);
export const TRADE = { power: 0.25, water: 0.04, waste: 3 };   // $ a month: per unit of spare power or water sold, per building's garbage sent away
const SURNAMES = ['Okafor', 'Bello', 'Garcia', 'Nguyen', 'Smith', 'Haddad', 'Kowalski', 'Mensah', 'Rossi', 'Tanaka', 'Silva', 'Ibrahim', 'Novak', 'Patel', 'Adeyemi', 'Murphy', 'Chen', 'Yusuf', 'Larsen', 'Moreau', 'Abubakar', 'Kim', 'Okonkwo', 'Fischer', 'Diallo', 'Costa', 'Ahmed', 'Brown', 'Eze', 'Santos'];
const WISH = { police: 'a police station nearby', fire: 'a fire station nearby', health: 'a clinic nearby', edu: 'a school for the kids', fun: 'a park or something fun to do', transit: 'a bus stop', poll: 'cleaner air', crime: 'safer streets', jam: 'less traffic', commute: 'a job closer to home' };
// Seasons in the simulation (Menu → Seasons → Always summer turns them off): 0 spring, 1 summer, 2 autumn, 3 winter, by month.
export const SIM_SEASON = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3];
export const SEASON_NAME = ['Spring', 'Summer', 'Autumn', 'Winter'];
// Specialised industry (stored in bits 4-5 of world.variant): 0 general, 1 farm, 2 forestry, 3 tech.
export const SPEC_NAME = ['', 'Farm', 'Forestry', 'Tech'];
export const SPEC_TITLE = [null, ['', 'Farm', 'Farmstead', 'Large farm', 'Agri-tech farm'], ['', 'Sawmill', 'Timber yard', 'Wood mill', 'Mass timber works'], ['', 'Tech workshop', 'Software studio', 'Tech park', 'Hi-tech campus']];
const GOODS_PER_JOB = [1, 0.8, 1, 0.3];             // goods made per industry job: general, farm (food), forestry, tech (mostly software)
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
    this.metroLinks = Array.isArray(s.metroLinks) ? s.metroLinks : null; this.metroNames = s.metroNames && typeof s.metroNames === 'object' ? s.metroNames : {};   // metro network (0.8.12); null: an older city, linked on first look
    this.repairs = new Map(Array.isArray(s.repairs) ? s.repairs.map(([i, big, left]) => [i, { big: !!big, left }]) : []);   // road repairs under way (0.9.0)
    this.inspected = !!s.inspected; this.jfix = s.jfix && typeof s.jfix === 'object' ? s.jfix : {}; world.jfix = this.jfix; this.sandbox = !!s.sandbox; this.sbMoney = s.sbMoney == null ? null : s.sbMoney;
    this.fund = { ...Object.fromEntries(FUND_GROUPS.map((k) => [k, 100])), ...(s.fund || {}) };   // service budgets, 50 to 150%
    this.trade = { power: false, water: false, waste: false, ...(s.trade || {}) };                 // deals with the neighbouring towns
    this.ages = s.ages ?? { kids: 0.26, adults: 0.6, seniors: 0.14 };                              // the city's age mix
    this.approval = s.approval ?? 60; this.taxCap = s.taxCap ?? null; this.lastVote = s.lastVote ?? null; this.prevPop = s.prevPop ?? 0;
    this.goods = { made: 0, need: 0, local: 0, imported: 0, exported: 0, importShare: 0 }; this.tradeIncome = 0; this.tradeCost = 0; this.wasteOut = 0;
    this.aband = new Uint8Array(N * N);              // 0 lived in, or why its people left (ABANDON_WHY)
    if (Array.isArray(s.aband)) for (const [i, c] of s.aband) if (i >= 0 && i < N * N) this.aband[i] = c;
    // traffic lights are kept in the save (0.8.7), so a loaded city doesn't start without them and grow them back
    if (Array.isArray(s.lights)) { const w = this.w; if (!w.jn || w.jn.length !== N * N) w.jn = new Uint8Array(N * N); if (!w.jhot) w.jhot = new Uint8Array(N * N); for (const i of s.lights) if (i >= 0 && i < N * N && w.kind[i] === T.ROAD) { w.jn[i] = SIGNAL; w.jhot[i] = 2; } }
    this.cut = 0; this.happiness = 60; this.hapParts = []; this.advice = [];
    this.traffic = null;                           // (old) live car count per tile; congestion now comes from trips (flow.js)
    this.flowM = new Flow(world);
    this.unlocked = new Set();
    this.events = [];
    this.grace = this.day + 90;         // older saves get time to wire up before buildings decay
    const n = N * N;
    this.pw = new Uint8Array(n); this.wt = new Uint8Array(n); this.ts = new Uint8Array(n);
    this.lv = new Float32Array(n); this.indPen = new Float32Array(n);
    this.crime = new Float32Array(n); this.poll = new Float32Array(n);
    this.cov = {}; for (const k of COVS) this.cov[k] = new Float32Array(n);
    this.powerMap = new Uint8Array(n); this.waterMap = new Uint8Array(n); this.wasteMap = new Uint8Array(n);
    this.facilities = []; this.hauls = []; this.haulVer = 0; this.facLoad = new Map(); this.xferInfo = new Map();
    this.hwNet = new Uint8Array(n); this.jobReach = new Uint8Array(n); this.workReach = new Uint8Array(n);
    this.seaLink = new Uint8Array(n);              // land tiles: 1 = ships from here reach the open sea, 2 = a bridge blocks the way, 0 = inland water or none
    this.ports = 0; this.portsBlocked = 0;
    this.trackX = new Uint8Array((N + 1) * (N + 1)); this.trackY = new Uint8Array((N + 1) * (N + 1)); this.trackLot = new Uint8Array(n); this.trackVer = 0;
    this.commute = new Float32Array(n); this.jam = new Float32Array(n); this.roadComp = new Int32Array(n);
    this.metroRide = new Float32Array(n); this.metroVia = new Int32Array(n).fill(-1); this.metroCost = new Float32Array(n).fill(Infinity); this.metroArrows = []; this.metroNet = null;
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
  state() { return { req: this.req, reqNext: this.reqNext, reqDone: this.reqDone, moods: this.moods, tourBoost: this.tourBoost, money: this.money, day: this.day, tax: this.tax, lastIncome: this.lastIncome, lastExpense: this.lastExpense, ord: this.ord, done: [...this.done], streak: this.streak, disasters: this.disasters, loans: this.loans, lastInterest: this.lastInterest, lastLoanPay: this.lastLoanPay, history: this.history, news: this.news, peakPop: this.peakPop, tut: this.tut, inspected: this.inspected, jfix: this.jfix, repairs: [...this.repairs].map(([i, r]) => [i, r.big ? 1 : 0, r.left]), lastRoadSpend: this.lastRoadSpend || 0, metroLinks: this.metroLinks || [], metroNames: this.metroNames, sandbox: !!this.sandbox, sbMoney: this.sbMoney == null ? null : this.sbMoney,
    fund: this.fund, trade: this.trade, ages: this.ages, approval: this.approval, taxCap: this.taxCap, lastVote: this.lastVote, prevPop: this.prevPop,
    aband: (() => { const a = []; for (let i = 0; i < N * N; i++) if (this.aband[i] && this.w.level[i]) a.push([i, this.aband[i]]); return a; })(),
    lights: (() => { const a = [], jn = this.w.jn; if (jn) for (let i = 0; i < N * N; i++) if (jn[i] === SIGNAL) a.push(i); return a; })() }; }
  ordOn(k) { return !!this.ord[k] && this.cut === 0; }          // ordinances are suspended while the city is in debt
  isUnlocked(k) { return this.sandbox || !UNLOCK[k] || this.unlocked.has(k); }
  closed(def) { const g = cutGroup(def); return !!g && this.cut >= CUT_STAGE[g]; }
  isClosedAt(i) { return this.w.kind[i] === T.SVC && this.closed(BT[this.w.bt[i]]); }
  pushNews(text) { this.news.unshift({ date: this.dateLabel(), text }); if (this.news.length > 30) this.news.length = 30; this.events.push({ type: 'news', text }); }

  recount() {
    const w = this.w;
    let emptyB = 0, made = 0; const wealth = [0, 0, 0];
    let iTax = 0, avenues = 0, ports = 0, blocked = 0, bridges = 0, pop = 0, cj = 0, ij = 0, roads = 0, parks = 0, rb = 0, cb = 0, ib = 0, top = 0, zr = 0, zc = 0, zi = 0, plants = 0;
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i], l = this.lvl(i);
      if (!l && this.aband[i]) this.aband[i] = 0;
      const empty = l && this.aband[i];
      if (k === T.ROAD) { roads++; if (w.terrain[i] === TERRAIN.WATER) bridges++; else if (w.level[i] === 1) avenues++; }
      else if (k === T.PARK) { if (!this.pending.has(i)) parks++; }
      else if (k === T.RES) { zr++; if (l) { rb++; if (empty) emptyB++; else { pop += POP_CAP[l]; const wt = wealthOf(this.landValue(i, k)); wealth[wt] += POP_CAP[l]; } } }
      else if (k === T.COM) { zc++; if (l) { cb++; if (empty) emptyB++; else cj += COM_CAP[l]; } }
      else if (k === T.IND) { zi++; if (l) { ib++; } if (l && empty) emptyB++; if (l && !empty) { const sp = (w.variant[i] >> 4) & 3, jobs = Math.round(IND_CAP[l] * SPEC_JOBS[sp]); ij += jobs; made += jobs * GOODS_PER_JOB[sp]; iTax += jobs * SPEC_TAX[sp] * (sp === 1 && this.SEASON_NOW === 2 ? 1.5 : 1); if (w.shore[i] >= 2) { if (this.seaLink[i] === 1) ports++; else if (this.seaLink[i] === 2) blocked++; } } }
      else if (k === T.SVC && w.bo[i] === 0 && BT[w.bt[i]].power) plants++;
      if (l === 4 && k >= T.RES && k <= T.IND) top++;
    }
    this.ports = ports; this.portsBlocked = blocked; this.iTax = iTax; this.avenues = avenues;
    this.pop = pop; this.cJobs = cj; this.iJobs = ij; this.roads = roads; this.bridges = bridges; this.parks = parks; this.plants = plants;
    this.bld = { r: rb, c: cb, i: ib, top, empty: emptyB }; this.zoned = { r: zr, c: zc, i: zi }; this.wealth = wealth;
    this.taxBase = wealth[0] * WEALTH_TAX[0] + wealth[1] * WEALTH_TAX[1] + wealth[2] * WEALTH_TAX[2];
    // goods: shops sell what local industry makes; what's missing is bought from the region, what's left over is sold to it
    const need = cj * 1.3, local = Math.min(made, need), imp = need - local;
    this.goods = { made: Math.round(made), need: Math.round(need), local: Math.round(local), imported: Math.round(imp), exported: Math.round(made - local), importShare: need > 0 ? imp / need : 0 };
    this.workforce = Math.round(pop * WORK_SHARE * (this.ages ? this.ages.adults / 0.6 : 1));
    const jobs = cj + ij;
    const tm = (t) => -(t - 9) * 0.04 + 0.14;
    const stad = Math.min(3, this.net.stadiums) * 0.06 + (this.ordOn('tourism') ? 0.08 : 0);
    const mood = ((this.happiness ?? 60) - 55) / 100 * 0.6;       // a happy city attracts people, an unhappy one drives them off
    const linked = this.hwRoads > 0;
    this.rd = clamp((jobs - pop * 0.6 + 18) / (40 + jobs * 0.25) + tm(this.tax.r) + mood, -1, 1);
    const sn = this.SEASON_NOW, seasonK = sn === 3 ? -0.06 : sn === 0 ? 0.03 : 0;            // winter slows building, spring speeds it up
    this.rd += seasonK;
    const gs = this.goods, short = clamp((gs.need - gs.made) / (40 + gs.made * 0.2), -1, 1);   // shops short of goods want factories nearby
    this.cd = clamp((pop * 0.3 - cj + 4) / (30 + cj * 0.2) + tm(this.tax.c) + stad + (linked ? 0 : -0.15) + seasonK + Math.min(0.25, this.tourists / (cj * 4 + 120)) + 0.05 * (1 - gs.importShare) - 0.03, -1, 1);   // visitors shop too; local goods are cheaper
    const port = ports > 0 ? 0.08 : 0;                         // a working sea port draws a little more industry
    this.id = clamp((pop * 0.4 - ij + 6) / (30 + ij * 0.2) + tm(this.tax.i) + (linked || ports ? 0 : -0.3) + port + clamp(short * 0.5, -0.08, 0.12), -1, 1);   // goods leave by the highway or by sea
    this.updateHappiness();
  }
  updateHappiness() {
    const n = this.net, avgTax = (this.tax.r + this.tax.c + this.tax.i) / 3;
    const parkBonus = Math.min(18, (this.parks * 400) / (this.pop + 100));
    const parts = []; let h = 58;
    const add = (label, v) => { h += v; if (Math.abs(v) >= 0.5) parts.push([label, Math.round(v)]); };
    add('Taxes', -(avgTax - 9) * 3.2); add('Parks', parkBonus); add('Too few jobs', -Math.max(0, -this.rd) * 12);
    const ag = this.ages || { kids: 0.26, seniors: 0.14 };
    add('Police', n.police * 7); add('Health care', n.health * 7 * (0.6 + 0.4 * ag.seniors / 0.14)); add('Schools', n.edu * 6 * (0.5 + 0.5 * ag.kids / 0.26)); add('Fire safety', n.fire * 3); add('Amenities', n.fun * 8); add('Buses', n.transit * 4); add('Metro', (n.metro || 0) * 5);
    add('Crime', -n.crimeAvg * 0.18); add('Pollution', -n.pollAvg * 0.16); add('Power cuts', -n.unserved * 30); add('Garbage', -n.wasteUn * 18);
    add('Empty buildings', -Math.min(4, ((this.bld && this.bld.empty) || 0) * 0.15)); add('Traffic', -n.jamAvg * 12); add('Long commutes', -n.noJob * 14); add('Budget cuts', -[0, 3, 7, 12][this.cut]);
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
    // 0.9.0: what each plant really makes (plantOutput): solar averaged over day and night, wind with the weather, nuclear
    // and gas need cooling water, coal and gas need their fuel by road from the highway. Batteries (touching a line) firm up
    // sun and wind on their network: they store the daytime surplus for the night and calm days.
    const info = this.plantInfo = new Map(), vari = new Map();
    for (const a of plants) {
      const o = this.plantOutput(a); info.set(a.i, o); pSup += o.out;
      if (a.comp >= 0) { const r = find(a.comp); out.set(r, (out.get(r) || 0) + o.out); if (o.vari) vari.set(r, (vari.get(r) || 0) + o.vari); }
    }
    const batts = anchors.filter((a) => a.def.store);
    for (const a of batts) {
      let r = -1; ring(a.x, a.y, a.def.w, a.def.d, 1, (c) => { if (r < 0 && c >= 0) r = find(c); }); a.comp = r;
      const add = r >= 0 ? Math.min(a.def.store, vari.get(r) || 0) : 0;
      if (add > 0) { out.set(r, (out.get(r) || 0) + add); vari.set(r, vari.get(r) - add); pSup += add; }
      info.set(a.i, { out: add, note: r < 0 ? 'Not touching a power line' : add < a.def.store ? (add > 0 ? 'Storing all the spare sun and wind on its lines' : 'No solar farm or wind turbine on its lines to store from') : 'Full use' });
    }
    const consumers = [];
    const heat = this.SEASON_NOW === 3 ? 1.25 : 1;                 // homes use more power for heating in winter
    for (const z of zones) consumers.push({ i: z.i, x: z.x, y: z.y, l: z.l, fw: 1, fd: 1, p: Math.ceil(ELEC[z.z][z.l] * (this.ordOn('energy') ? 0.85 : 1) * (z.z === 'r' ? heat : 1)), wa: Math.ceil(WATER[z.z][z.l] * (this.ordOn('water') ? 0.8 : 1)), ws: Math.ceil(WASTE[z.z][z.l] * (this.ordOn('recycle') ? 0.75 : 1)), zone: true });
    for (const a of anchors) if (!a.def.power && a.def.use && !this.closed(a.def)) consumers.push({ i: a.i, x: a.x, y: a.y, fw: a.def.w, fd: a.def.d, p: a.def.use, wa: a.def.water ? 0 : 2, ws: 0 });
    // A building takes power from a line within 2 tiles. In reach of more than one network it takes the one with the most
    // power to spare. (Before 0.7.2 it took whichever network it found first, so a dead stub or a short network next to a
    // live line left buildings dark even when the city made plenty of power.)
    const pick = (cands, outM, demM, need) => {
      if (!cands.length) return -1; if (cands.length === 1) return cands[0];
      let best = cands[0], bv = -1e9; for (const r of cands) { const v = (outM.get(r) || 0) - (demM.get(r) || 0); if (v > bv) { bv = v; best = r; } }
      demM.set(best, (demM.get(best) || 0) + need); return best;
    };
    for (const c of consumers) {
      const cs = []; ring(c.x, c.y, c.fw, c.fd, 2, (cc) => { if (cc >= 0) { const r = find(cc); if (!cs.includes(r)) cs.push(r); } });
      c.pc = cs; pDem += c.p;
      if (cs.length === 1) { c.root = cs[0]; dem.set(cs[0], (dem.get(cs[0]) || 0) + c.p); } else c.root = -1;
    }
    for (const c of consumers) if (c.pc.length > 1) c.root = pick(c.pc, out, dem, c.p);
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
    const ll = this.lineLive && this.lineLive.length === n ? this.lineLive : (this.lineLive = new Uint8Array(n));
    for (let i = 0; i < n; i++) {                   // lines: live or dead. A building on a cable keeps its own red or green in the power view
      ll[i] = comp[i] >= 0 ? ((out.get(find(comp[i])) || 0) > 0 ? 1 : 2) : 0;
      if (ll[i] && this.powerMap[i] === 0) this.powerMap[i] = ll[i] === 1 ? 3 : 4;
    }
    for (let i = 0; i < n; i++) if (w.kind[i] === T.ROAD && !w.wire[i]) {   // street lamps work near live lines
      const x = i % N, y = (i / N) | 0; let live = false;
      ring(x, y, 1, 1, 2, (c) => { if (!live && c >= 0 && (out.get(find(c)) || 0) > 0) live = true; });
      if (live) this.powerMap[i] = 3;
    }

    // cooling water from the pipes for nuclear and gas plants that aren't by a lake or the sea (0.9.0)
    for (const a of plants) { const o = info.get(a.i); if (o.coolPipe) consumers.push({ i: a.i, x: a.x, y: a.y, fw: a.def.w, fd: a.def.d, p: 0, wa: o.coolPipe, ws: 0, cool: true }); }
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
    for (const c of consumers) {                     // like power: a building in reach of two pipe networks takes the better one
      wDem += c.wa; const cs = []; pring(c.x, c.y, c.fw, c.fd, 2, (cc) => { if (cc >= 0) { const r = pfind(cc); if (!cs.includes(r)) cs.push(r); } });
      c.wc = cs; if (cs.length === 1) { c.wroot = cs[0]; wdem.set(cs[0], (wdem.get(cs[0]) || 0) + c.wa); } else c.wroot = -1;
    }
    for (const c of consumers) if (c.wc.length > 1) c.wroot = pick(c.wc, wout, wdem, c.wa);
    // 0.9.0 sewage: buildings that get water (level 2 and up; houses have septic tanks) send it back down the pipes. A sewage
    // works touching a network's pipes cleans up to its capacity (30% without power) and 35% of what it cleans comes back as
    // water for that network. The rest flows untreated into the nearest lake, river or sea (or a ditch on dry land).
    {
      const treat = new Map(), sin = new Map(), cnt = new Map(), cx = new Map(), cy = new Map(), works = anchors.filter((a) => a.def.sewer);
      for (const a of works) { let f = -1; pring(a.x, a.y, a.def.w, a.def.d, 1, (c) => { if (f < 0 && c >= 0) f = c; }); a.pcomp = f; if (f >= 0) { const r = pfind(f); a.sroot = r; treat.set(r, (treat.get(r) || 0) + a.def.sewer * (this.pw[a.i] ? 1 : 0.3)); } }
      for (const c of consumers) if (c.zone && c.l >= 2 && c.wroot >= 0 && (wout.get(c.wroot) || 0) > 0) {   // no water in the pipes, no sewage
        const r = c.wroot, v = c.wa * 0.9; sin.set(r, (sin.get(r) || 0) + v); cnt.set(r, (cnt.get(r) || 0) + 1); cx.set(r, (cx.get(r) || 0) + c.x * v); cy.set(r, (cy.get(r) || 0) + c.y * v); }
      let total = 0, treated = 0, bad = 0; const outs = [], info = new Map();
      for (const [r, v] of sin) {
        const t = Math.min(v, treat.get(r) || 0), u = v - t; total += v; treated += t;
        if (t > 0) { wout.set(r, (wout.get(r) || 0) + t * 0.35); wSup += Math.round(t * 0.35); }
        if (u > 1) { const nb = Math.round((cnt.get(r) || 0) * u / v); bad += nb; outs.push({ x: Math.round(cx.get(r) / v), y: Math.round(cy.get(r) / v), amt: u, nb }); }
      }
      for (const a of works) { const r = a.sroot, cap = a.def.sewer * (this.pw[a.i] ? 1 : 0.3), all = r !== undefined ? treat.get(r) || 0 : 0, load = r !== undefined && all > 0 ? Math.min(sin.get(r) || 0, all) * (cap / all) : 0; info.set(a.i, { cap: Math.round(cap), load: Math.round(load), back: Math.round(load * 0.35), piped: a.pcomp >= 0 }); }
      // where it comes out: the water tile nearest the middle of the network's homes and businesses
      for (const o of outs) {
        let best = -1, bd = 1e9;
        for (let y = Math.max(0, o.y - 40); y <= Math.min(N - 1, o.y + 40); y++) for (let x = Math.max(0, o.x - 40); x <= Math.min(N - 1, o.x + 40); x++) { const q = y * N + x; if (w.terrain[q] !== TERRAIN.WATER || w.kind[q] === T.ROAD) continue; const d = (x - o.x) ** 2 + (y - o.y) ** 2; if (d < bd) { bd = d; best = q; } }
        o.water = best >= 0; if (best >= 0) { o.x = best % N; o.y = (best / N) | 0; }
      }
      this.sewage = { total: Math.round(total), treated: Math.round(treated), outs, buildings: bad }; this.sewInfo = info;
    }
    this.wt.fill(0); this.waterMap.fill(0);
    for (const c of consumers) {
      const o = c.wroot >= 0 ? wout.get(c.wroot) || 0 : 0, d = wdem.get(c.wroot) || 1, ratio = Math.min(1, o / d);
      const ok = c.wroot >= 0 && o > 0 && hash(c.x, c.y, 2) < ratio + 1e-6;
      this.wt[c.i] = ok ? 1 : 0; this.waterMap[c.i] = ok ? 3 : 2;
    }
    const coolWas = this.coolOk; this.coolOk = new Set(consumers.filter((c) => c.cool && this.wt[c.i]).map((c) => c.i));   // read by plantOutput next time
    if (!coolWas || [...this.coolOk].some((i) => !coolWas.has(i)) || [...coolWas].some((i) => !this.coolOk.has(i) && info.has(i))) this.needAn = true;   // cooling changed: work power out again soon
    for (let i = 0; i < n; i++) if (pc[i] >= 0 && this.waterMap[i] === 0) this.waterMap[i] = (wout.get(pfind(pc[i])) || 0) > 0 ? 4 : 5;

    // waste: facilities collect from buildings in range, up to capacity (recycling needs power)
    const fac = this.facilities, fcap = fac.map((f) => f.def.waste * (!f.def.use || this.pw[f.i] ? 1 : 0.3)), fload = fac.map(() => 0), fvia = fac.map(() => 0);
    const xfs = anchors.filter((a) => a.def.xfer);       // transfer stations (0.8.10): collect around them, send it on by road
    this.wasteMap.fill(0); this.ts.fill(0);
    const reach = (cx, cy, R) => {
      for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R) this.wasteMap[y * N + x] = 1;
      }
    };
    for (const f of fac) reach(f.x + f.def.w / 2, f.y + f.def.d / 2, f.def.radius);
    for (const s of xfs) reach(s.x + 0.5, s.y + 0.5, s.def.radius);
    let tDem = 0, tSup = 0, wUn = 0, zc = 0; for (const f of fac) tSup += f.def.waste;
    // Every building is served by the nearest landfill or recycling center in range that still has room. (Before 0.7.2 it
    // only tried the nearest one, so a full landfill left its street uncollected while another one nearby sat half empty.)
    const zc2 = consumers.filter((c) => c.zone), pairs = [];
    for (let ci = 0; ci < zc2.length; ci++) {
      const c = zc2[ci]; tDem += c.ws; c.fac = -1; c.inRange = false;
      fac.forEach((f, fi) => { const d = Math.hypot(c.x + 0.5 - (f.x + f.def.w / 2), c.y + 0.5 - (f.y + f.def.d / 2)); if (d <= f.def.radius) { pairs.push([d, ci, fi]); c.inRange = true; } });
    }
    // buildings that need collection (level 2 and up) are served first; houses at level 1 only take what is left
    const needFirst = (a, b) => (zc2[a[1]].l >= 2 ? 0 : 1) - (zc2[b[1]].l >= 2 ? 0 : 1) || a[0] - b[0];
    pairs.sort(needFirst);
    for (const [, ci, fi] of pairs) { const c = zc2[ci]; if (c.fac >= 0 || fload[fi] + c.ws > fcap[fi]) continue; c.fac = fi; fload[fi] += c.ws; }
    // Transfer stations take what is left: each one sends its garbage to the waste building with room that is nearest by road,
    // then the next nearest, and so on. Only buildings that weren't served directly go through a station.
    const routes = this.xferRoutes(xfs, fac), xinfo = new Map();
    xfs.forEach((s, si) => xinfo.set(s.i, { road: routes[si].road, dests: routes[si].dests.map((t) => ({ name: fac[t.fi].def.name, i: fac[t.fi].i, dist: t.dist, amt: 0 })), served: 0, stuck: 0, sent: 0 }));
    const xpairs = [];
    for (let ci = 0; ci < zc2.length; ci++) {
      const c = zc2[ci]; if (c.fac >= 0) continue;
      xfs.forEach((s, si) => { const d = Math.hypot(c.x - s.x, c.y - s.y); if (d <= s.def.radius) { xpairs.push([d, ci, si]); c.inRange = true; (c.xs || (c.xs = [])).push(si); } });
    }
    xpairs.sort(needFirst);
    for (const [, ci, si] of xpairs) {
      const c = zc2[ci]; if (c.fac >= 0) continue;
      const r = routes[si];
      for (let k = 0; k < r.dests.length; k++) {
        const t = r.dests[k]; if (fload[t.fi] + c.ws > fcap[t.fi]) continue;
        c.fac = t.fi; fload[t.fi] += c.ws; fvia[t.fi] += c.ws; t.amt += c.ws;
        const xi = xinfo.get(xfs[si].i); xi.served++; xi.sent += c.ws; xi.dests[k].amt += c.ws;
        break;
      }
    }
    let wOut = 0, wFull = 0, wasteOut = 0, xStuck = 0;
    for (const c of zc2) {
      zc++;
      let ok = c.fac >= 0;
      if (!ok && c.l >= 2 && this.trade.waste && this.hwNet[c.i]) { ok = true; wasteOut++; }   // trucked to the neighbouring town's landfill
      this.ts[c.i] = ok ? 1 : 0; this.wasteMap[c.i] = ok ? 3 : c.l >= 2 ? 2 : c.inRange ? 1 : 0;   // red only where it's needed
      if (!ok && c.l >= 2) { wUn++; if (c.inRange) wFull++; else wOut++; }   // level 1 doesn't need collection yet: not counted, no badge
      if (!ok && c.l >= 2 && c.xs && c.xs.some((si) => routes[si].dests.length)) { xStuck++; for (const si of c.xs) if (routes[si].dests.length) xinfo.get(xfs[si].i).stuck++; }
    }
    // what each waste building holds and how much of it came through transfer stations (Inspector), and the trucks' routes
    this.facLoad = new Map(fac.map((f, fi) => [f.i, { load: fload[fi], cap: fcap[fi], via: fvia[fi] }]));
    this.xferInfo = xinfo;
    const hauls = [];
    routes.forEach((r) => { for (const t of r.dests) if (t.amt > 0 && t.path && t.path.length >= 2) hauls.push({ path: t.path, amt: t.amt }); });
    const hsig = hauls.map((h) => h.path[0] + '>' + h.path[h.path.length - 1]).join(',');
    if (hsig !== this.haulSig) { this.haulSig = hsig; this.haulVer = (this.haulVer || 0) + 1; }
    this.hauls = hauls;
    const xNoRoad = xfs.filter((s, si) => !routes[si].road).length, xNoDest = xfs.filter((s, si) => routes[si].road && !routes[si].dests.length).length;

    // Why a utility can fall short while the totals look fine: plants or pumps not touching a line or pipe, power or water
    // split over networks that aren't joined, or buildings out of reach of any line, pipe or landfill. Read by the advisors.
    const diag = { pLoose: plants.filter((a) => a.comp < 0).map((a) => a.def.name), wLoose: sources.filter((a) => a.pcomp < 0).map((a) => a.def.name),
      pNoLine: consumers.filter((c) => c.root < 0).length, wNoPipe: consumers.filter((c) => c.wroot < 0).length, pShort: 0, pSpare: 0, wShort: 0, wSpare: 0,
      pumpsDark: sources.filter((a) => a.def.use && !this.pw[a.i]).length, wOut, wFull, xNoRoad, xNoDest, xStuck };
    { // one example of each problem, for the advisors' "Show on map" (0.8.13)
      const xy = (a) => (a ? { x: a.x, y: a.y } : null), un = zc2.filter((c) => c.fac < 0 && c.l >= 2 && !this.ts[c.i]);
      diag.at = { pLoose: xy(plants.find((a) => a.comp < 0)), wLoose: xy(sources.find((a) => a.pcomp < 0)), pNoLine: xy(consumers.find((c) => c.root < 0)), wNoPipe: xy(consumers.find((c) => c.wroot < 0)),
        pumpsDark: xy(sources.find((a) => a.def.use && !this.pw[a.i])), wOut: xy(un.find((c) => !c.inRange)), wFull: xy(un.find((c) => c.inRange)), xStuck: xy(un.find((c) => c.xs)),
        xNoRoad: xy(xfs.find((q, si) => !routes[si].road)), xNoDest: xy(xfs.find((q, si) => routes[si].road && !routes[si].dests.length)) };
    }
    for (const [r, o] of out) { const d = dem.get(r) || 0; if (o >= d) diag.pSpare += o - d; }
    for (const [r, d] of dem) { const o = out.get(r) || 0; if (o < d) diag.pShort += d - o; }
    for (const [r, o] of wout) { const d = wdem.get(r) || 0; if (o >= d) diag.wSpare += o - d; }
    for (const [r, d] of wdem) { const o = wout.get(r) || 0; if (o < d) diag.wShort += d - o; }
    diag.unwatered = consumers.filter((c) => !this.wt[c.i]).length; diag.unpowered = unpowered;
    this.uDiag = diag; this.wasteOut = wasteOut;
    this.tracks();
    this._an = { anchors, zones, empties, consumers, unpowered, pSup, pDem, wSup, wDem, tDem, tSup, wUn, zc };
  }
  // stage 2: service and amenity coverage
  anCoverage() {
    const { anchors } = this._an;
    for (const k of COVS) this.cov[k].fill(0);
    this.linkFerries(anchors);
    const net = buildMetro(this, anchors); this.metroLinked = net.st.some(serving);
    let upkeep = 0, stadiums = 0;
    let uni = false;
    for (const a of anchors) {
      const shut = this.closed(a.def);
      const fg = fundGroup(a.def), fk = fg ? (this.fund[fg] ?? 100) / 100 : 1;   // service budget: 50% to 150%
      upkeep += a.def.upkeep * (shut ? 0.2 : fk);       // a closed building only costs basic maintenance
      if (shut) continue;
      if (a.def.key === 'stadium') stadiums++;
      if (a.def.key === 'university') uni = true;
      if (!a.def.cov) continue;
      if (a.def.ferry && !this.ferryLinks.get(a.i)) continue;      // a ferry pier only serves once a ferry runs to another pier
      if (a.def.metro && !serving(net.by.get(a.i))) continue;       // a station serves once it is linked to another (0.8.12)
      const eff = (a.def.use === undefined || this.pw[a.i] ? 1 : 0.3) * (0.5 + 0.5 * fk) * (a.def.shore ? this.shoreClean(a) : 1), R = a.def.radius * (0.85 + 0.15 * fk), cx = a.x + a.def.w / 2, cy = a.y + a.def.d / 2;
      for (const [key, str] of a.def.cov) {
        const arr = this.cov[key];
        for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d >= R) continue;
          const v = Math.min(1, (1 - d / R) * 1.6 * str) * eff, q = y * N + x; if (v > arr[q]) arr[q] = v;
        }
      }
    }
    upkeep += net.tiles * TUNNEL_UPKEEP;                            // tunnels
    this.hasUni = uni; this._an.upkeep = upkeep; this._an.stadiums = stadiums;
  }
  // stage 3: road networks, highway link and commutes (only when roads changed or every 6 days)
  anRoads() {
    const { zones, empties } = this._an;
    if (this.roadsDirty !== false || this.day - (this.roadsDay ?? -99) >= 6 || this.flowM.version !== this.roadsFlowV) { this.analyzeRoads(zones, empties); this.roadsDirty = false; this.roadsDay = this.day; this.roadsFlowV = this.flowM.version; }   // also when the traffic picture is new

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
      if (ZK[k] && l >= 2 && !this.ts[i]) add(poll, x, y, 2, l * 3, true);   // uncollected garbage (level 1 doesn't need collection yet)
    }
    for (let i = 0; i < n; i++) if (this.jam[i] > 0) poll[i] += this.jam[i] * 6;            // exhaust and noise from jammed roads
    for (const a of anchors) if (a.def.pollute) add(poll, a.x, a.y, a.def.pr || 6, a.def.pollute * scrub, true);
    // 0.9.0: untreated sewage. In water it spreads through the lake or sea from where it comes out (dirty water, shown on
    // the map, spoils beaches, piers and marinas and the waterfront); on dry land it fouls the ground around the ditch.
    {
      const dw = this.dirtyWater || (this.dirtyWater = new Float32Array(n)); dw.fill(0); const list = [];
      for (const o of (this.sewage && this.sewage.outs) || []) {
        const R = Math.min(18, 3 + o.amt / 50), amt = Math.min(45, 6 + o.amt / 12);
        add(poll, o.x, o.y, Math.min(9, Math.round(R / 2) + 2), amt * (o.water ? 0.5 : 1), true);
        if (!o.water) continue;
        const q = [o.y * N + o.x], seen = new Map([[q[0], 0]]);       // spread through connected water, fading with distance
        for (let h = 0; h < q.length; h++) {
          const c = q[h], d = seen.get(c), v = (1 - d / R) * Math.min(1, o.amt / 150 + 0.35); if (v > dw[c]) dw[c] = v;
          if (d + 1 >= R) continue;
          const x = c % N, y = (c / N) | 0;
          for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const r = yy * N + xx; if (seen.has(r) || w.terrain[r] !== TERRAIN.WATER) continue; seen.set(r, d + 1); q.push(r); }
        }
      }
      for (let i = 0; i < n; i++) if (dw[i] > 0.05) { list.push(i); const x = i % N, y = (i / N) | 0; for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && w.terrain[yy * N + xx] !== TERRAIN.WATER) poll[yy * N + xx] += dw[i] * 14; } }   // a smelly shore
      this.dirtyList = list; this.dirtyVer = (this.dirtyVer || 0) + 1;
    }
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
  landValue(i, z) { return this.lv[i] - (z === T.RES ? Math.min(24, this.indPen[i]) : 0) + (z === T.IND ? Math.min(16, this.poll[i] * 0.28) : 0); }   // factories don't mind smoke (0.8.6)

  // Transfer stations (0.8.10): for each one, the waste buildings it can reach by road, nearest first, with the road path
  // there for the trucks. A station uses the roads next to its lot; a waste building is reached at any road touching its lot.
  // One breadth-first search over the roads per station (9,216 tiles at most), run with the daily network analysis.
  xferRoutes(xfs, fac) {
    const w = this.w, n = N * N;
    if (!xfs.length) return [];
    const edge = (x0, y0, fw, fd) => { const out = []; for (let y = y0 - 1; y <= y0 + fd; y++) for (let x = x0 - 1; x <= x0 + fw; x++) { if ((x === x0 - 1 || x === x0 + fw) === (y === y0 - 1 || y === y0 + fd)) continue; if (w.isRoad(x, y)) out.push(y * N + x); } return out; };
    const fRoads = fac.map((f) => edge(f.x, f.y, f.def.w, f.def.d));
    const dist = this._xd || (this._xd = new Int32Array(n)), par = this._xp || (this._xp = new Int32Array(n)), q = this._xq || (this._xq = new Int32Array(n));
    return xfs.map((s) => {
      const src = edge(s.x, s.y, s.def.w, s.def.d);
      if (!src.length) return { road: false, dests: [] };
      dist.fill(-1); let h = 0, tl = 0;
      for (const i of src) { dist[i] = 0; par[i] = -1; q[tl++] = i; }
      while (h < tl) {
        const c = q[h++], x = c % N, y = (c / N) | 0;
        for (const [dx, dy] of D4) { const xx = x + dx, yy = y + dy; if (!w.inb(xx, yy)) continue; const r = yy * N + xx; if (dist[r] >= 0 || w.kind[r] !== T.ROAD) continue; dist[r] = dist[c] + 1; par[r] = c; q[tl++] = r; }
      }
      const dests = [];
      fac.forEach((f, fi) => {
        let best = -1; for (const r of fRoads[fi]) if (dist[r] >= 0 && (best < 0 || dist[r] < dist[best])) best = r;
        if (best < 0) return;
        const path = []; for (let c = best; c >= 0; c = par[c]) path.push(c); path.reverse();
        dests.push({ fi, dist: dist[best], path, amt: 0 });
      });
      dests.sort((a, b) => a.dist - b.dist);
      return { road: true, dests };
    });
  }

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
    const jam = this.jam, ld = this.flowM.load; jam.fill(0);
    if (this.roadsDirty !== false) this.flowM.dirty = true;                  // roads changed: work the trips out again soon
    for (let i = 0; i < n; i++) {
      if (w.kind[i] !== T.ROAD) continue;
      const v = clamp((ld[i] - 0.85) / 0.65, 0, 1); if (v <= 0) continue;     // past capacity (from real trips; avenues and the highway carry more)
      const x = i % N, y = (i / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (w.inb(xx, yy)) { const q = yy * N + xx; if (v > jam[q]) jam[q] = v; } }
    }
    // travel cost along roads: jammed roads count as longer trips
    const fc = this.flowM.cost, cost = (i) => Math.min(3.5, fc[i]);           // travel time through a tile: quicker on avenues, slower when jammed
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
    const mc = this.metroCost = metroCommutes(this, zones.filter((z) => !this.pending.has(z.i)), jobD, homeD, roadsNear);   // the commute by metro, where there is one (0.8.12)
    this.hwNet.fill(0); this.jobReach.fill(0); this.workReach.fill(0); this.commute.fill(255);
    let noJobN = 0, noWorkN = 0, offGrid = 0; const md = { car: 0, bus: 0, metro: 0, walk: 0, none: 0 };   // how residents get to work (0.8.13)
    const few = this.cJobs + this.iJobs < 40, fewPeople = this.pop < 40;     // a brand-new town gets a pass
    for (const z of zones.concat(empties)) {
      const k = w.kind[z.i], rs = roadsNear(z.x, z.y);
      let best = 1e9, hw = false;
      const D = k === T.RES ? jobD : homeD;
      for (const q of rs) { if (hwComp.has(rc[q])) hw = true; if (D[q] < best) best = D[q]; }
      const reach = COMMUTE + 12 * this.cov.transit[z.i];              // buses stretch how far people will go
      if (this.trackLot[z.i] && best < 1e9) best += 2;               // walking or driving the dirt track to the street first
      let byMetro = false;
      if (mc[z.i] < best) { best = mc[z.i]; byMetro = true; if (k === T.RES) this.metroRide[z.i] = 1; } else this.metroVia[z.i] = -1;   // quicker by metro: they take it
      this.hwNet[z.i] = hw ? 1 : 0; this.commute[z.i] = Math.min(255, best);
      const ok = best <= reach + (byMetro ? METRO_EXTRA : 0);           // no driving: people put up with a longer ride
      if (k === T.RES) {
        this.jobReach[z.i] = ok || few ? 1 : 0; if (z.l && !this.jobReach[z.i]) noJobN++;
        if (z.l) { const p = POP_CAP[z.l]; if (!this.jobReach[z.i]) md.none += p; else if (byMetro) md.metro += p; else { const bus = Math.min(0.7, 0.4 * this.cov.transit[z.i]); md.bus += p * bus; if (best <= 4) md.walk += p * (1 - bus); else md.car += p * (1 - bus); } }
      }
      else { this.workReach[z.i] = ok || fewPeople ? 1 : 0; if (z.l && !this.workReach[z.i]) noWorkN++; }
      if (rs.length && !hw) offGrid++;
    }
    Object.assign(this.net, { noJobN, noWorkN, offGrid });
    { const tot = md.car + md.bus + md.metro + md.walk + md.none; this.modes = tot ? Object.fromEntries(Object.entries(md).map(([k, v]) => [k, Math.round((v / tot) * 100)])) : null; if (!this.modesPrev && this.modes) this.modesPrev = { ...this.modes }; }
    this.metroArrows = metroNeed(this, DISTRICT, DISTRICTS);
    if (this.metroNet) { let r = 0; for (const s of this.metroNet.st) { s.board = 0; s.alight = 0; } for (const z of zones) if (this.metroRide[z.i] && this.metroVia[z.i] >= 0) { const v = this.metroVia[z.i], p = POP_CAP[z.l]; const a = this.metroNet.st[(v / 1024) | 0], b = this.metroNet.st[v % 1024]; if (a && b) { a.board += p; b.alight += p; r += p; } } this.metroRiders = r; }
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
  // A junction set by hand (Inspector): 'auto', 'sig' (lights), 'v' or 'h' (priority to the road along y or x).
  setJunction(x, y, v) {
    const w = this.w; if (!w.inb(x, y)) return; const i = y * N + x;
    if (v === 'auto') delete this.jfix[i]; else this.jfix[i] = { sig: SIGNAL, v: PRI_V, h: PRI_H }[v];
    if (w.jn) w.jn[i] = this.jfix[i] || defaultJunction(w, x, y);
    this.flowM.dirty = true;
  }
  // ---- dirt tracks (0.7.4) ----
  // A road tile next to it (not just diagonally or 2 tiles away) is a lot's frontage.
  fronts(i) { const w = this.w, x = i % N, y = (i / N) | 0; return w.isRoad(x, y - 1) || w.isRoad(x + 1, y) || w.isRoad(x, y + 1) || w.isRoad(x - 1, y); }
  // Built lots without frontage get a dirt track to the nearest road. Tracks run along tile sides (in the gap between
  // lots, never under a building), from a corner of the lot to a corner that touches a road. One search from every
  // road corner outwards gives a distance to the road for each corner; each lot then walks downhill from its nearest
  // corner, joining tracks already laid where it can, so a back row shares one lane.
  // trackX[c] marks the side from corner c = (cx, cy) to (cx + 1, cy); trackY[c] the side from c to (cx, cy + 1).
  tracks() {
    const w = this.w, M = N + 1, nc = M * M, tx = this.trackX, ty = this.trackY, lot = this.trackLot;
    const dist = this._tkD || (this._tkD = new Int16Array(nc)), q = this._tkQ || (this._tkQ = new Int32Array(nc));
    const before = this._tkSig || 0; let sig = 0;
    tx.fill(0); ty.fill(0); lot.fill(0); dist.fill(-1);
    const land = (x, y) => { if (x < 0 || y < 0 || x >= N || y >= N) return false; const i = y * N + x, k = w.kind[i]; return w.terrain[i] !== TERRAIN.WATER && (k === T.EMPTY || k === T.PARK || k === T.RES || k === T.COM || k === T.IND); };
    const road = (x, y) => x >= 0 && y >= 0 && x < N && y < N && w.kind[y * N + x] === T.ROAD && w.terrain[y * N + x] !== TERRAIN.WATER;
    let h = 0, t = 0;
    for (let cy = 0; cy < M; cy++) for (let cx = 0; cx < M; cx++) if (road(cx - 1, cy - 1) || road(cx, cy - 1) || road(cx - 1, cy) || road(cx, cy)) { const c = cy * M + cx; dist[c] = 0; q[t++] = c; }
    const MAXD = 6;
    // the sides a track may use: both tiles beside it are open land, lots or parks
    const sideX = (cx, cy) => land(cx, cy - 1) && land(cx, cy);           // side from (cx, cy) to (cx + 1, cy)
    const sideY = (cx, cy) => land(cx - 1, cy) && land(cx, cy);           // side from (cx, cy) to (cx, cy + 1)
    const nbrs = (c, fn) => {
      const cx = c % M, cy = (c / M) | 0;
      if (cx + 1 < M && sideX(cx, cy)) fn(c + 1, 'x', c);
      if (cx > 0 && sideX(cx - 1, cy)) fn(c - 1, 'x', c - 1);
      if (cy + 1 < M && sideY(cx, cy)) fn(c + M, 'y', c);
      if (cy > 0 && sideY(cx, cy - 1)) fn(c - M, 'y', c - M);
    };
    while (h < t) { const c = q[h++], d = dist[c]; if (d >= MAXD) continue; nbrs(c, (o) => { if (dist[o] < 0) { dist[o] = d + 1; q[t++] = o; } }); }
    // the lots that need a track, nearest first, so later ones can join the earlier ones
    const need = [];
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i]; if ((k !== T.RES && k !== T.COM && k !== T.IND) || !w.level[i] || this.fronts(i)) continue;
      const x = i % N, y = (i / N) | 0; let best = -1, bd = 99;
      for (const c of [(y + 1) * M + x + 1, (y + 1) * M + x, y * M + x + 1, y * M + x]) if (dist[c] >= 0 && dist[c] < bd) { bd = dist[c]; best = c; }   // front corners first
      if (best >= 0) need.push([bd, i, best]);
    }
    need.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const paths = [];                                   // corner lists from each lot to its road, for people walking the tracks
    for (const [, i, start] of need) {
      lot[i] = 1; let c = start; const pts = [c];
      while (dist[c] > 0) {
        let pick = -1, kind = '', at = -1, laid = false;
        nbrs(c, (o, k2, e) => { if (dist[o] !== dist[c] - 1) return; const on = k2 === 'x' ? tx[e] : ty[e]; if (pick < 0 || (on && !laid)) { pick = o; kind = k2; at = e; laid = !!on; } });
        if (pick < 0) break;
        if (kind === 'x') tx[at] = 1; else ty[at] = 1;
        sig = (sig * 31 + at * 2 + (kind === 'x' ? 1 : 0)) | 0; c = pick; pts.push(c);
      }
      if (pts.length > 1) paths.push({ i, pts });
      sig = (sig * 17 + i) | 0;
    }
    this.trackPaths = paths;
    if (sig !== before) { this._tkSig = sig; this.trackVer++; }
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
    if (this.aband[i]) return `Standing empty: its ${k === T.RES ? 'residents' : 'business'} left (${ABANDON_WHY[this.aband[i]]})`;
    if (lvl >= MAX_LEVEL) return null;
    if (lvl >= TRACK_MAX && !this.fronts(i)) return this.trackLot[i] ? 'Only a dirt track reaches it. A road next to it lets it grow taller' : 'No road next to it. A road next to it lets it grow taller';
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
    roadDay(this);                                       // roads wear, crews repair them (0.9.0)
    if ((this.needAn && this.day - (this.lastAn ?? -9) >= 2) || this.day - (this.lastAn ?? -9) >= 8) { this.startAnalyze(); this.lastAn = this.day; }   // growth is batched instead of recalculating every day
    const w = this.w, rnd = this.rnd, h = this.happiness;
    for (let n = 0; n < 600; n++) {
      const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N), i = w.idx(x, y);
      const z = w.kind[i];
      if (z !== T.RES && z !== T.COM && z !== T.IND) continue;
      if (this.pending.has(i)) continue;
      const d = this.zoneDemand(z), lvl = w.level[i];
      const road = w.roadNear(x, y, 2);
      if (!road) { if (lvl && rnd() < 0.03) { w.level[i] = lvl - 1; if (z === T.RES && !this.aband[i]) this.events.push({ type: 'moveOut', i, n: POP_CAP[lvl] - POP_CAP[lvl - 1] }); } continue; }
      const grow = (to) => { const pv = w.variant[i], sp = z === T.IND ? (lvl === 0 ? this.pickSpec(i) : (pv >> 4) & 3) : 0; w.level[i] = to; w.variant[i] = Math.floor(rnd() * 16) | (sp << 4); this.aband[i] = 0; this.needAn = true; this.markBuilt(i, { kind: z, from: lvl, to, pv }); };   // 8 looks per building (4..7 add roof and street details; +8 = second colour family)
      if (lvl === 0) {
        if (!this.blocker(i, z, 0) && rnd() < 0.15 + 0.5 * Math.max(0, d)) grow(1);
        continue;
      }
      // 0.8.6: a building in trouble first stands empty (its people leave, it goes dark and gets boarded up). If things
      // stay bad it's torn down to a smaller one, still empty; if they get better, new people move back in.
      let bad = 0;
      if (this.day > this.grace) { if (!this.pw[i]) bad = 1; else if (!this.linkedOut(i)) bad = 2; else if (z === T.RES ? !this.jobReach[i] : !this.workReach[i]) bad = 3; }
      if (!bad && z === T.RES && h < 35) bad = 4;
      if (!bad && d < -0.25) bad = 5;
      const empty = this.aband[i];
      if (bad) {
        const pr = [0, 0.02, 0.012, 0.012, ((35 - h) / 35) * 0.04, 0.06 + Math.max(0, -0.35 - d) * 0.1][bad];
        if (rnd() < pr) {
          if (!empty) { this.aband[i] = bad; this.needAn = true; if (z === T.RES) this.events.push({ type: 'moveOut', i, n: POP_CAP[lvl] }); }
          else if (rnd() < 0.35) { w.level[i] = lvl - 1; if (lvl === 1) this.aband[i] = 0; else this.aband[i] = bad; this.needAn = true; }   // torn down to a smaller building
        }
        continue;
      }
      if (empty) {                                       // things are fine again: someone moves in
        if (rnd() < 0.08 + 0.3 * Math.max(0, d)) { this.aband[i] = 0; this.needAn = true; if (z === T.RES) this.events.push({ type: 'moveIn', i, n: POP_CAP[lvl] }); }
        continue;
      }
      if (lvl < MAX_LEVEL && !this.blocker(i, z, lvl) && rnd() < 0.1 * d + 0.02 + (z === T.RES ? Math.max(0, h - 60) / 400 : 0)) grow(lvl + 1);
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
    if (this.modes) this.modesPrev = { ...this.modes };            // compared with now in City \u2192 Budget (0.8.13)
    const n = this.net, served = 0.5 + 0.5 * (1 - n.unserved);
    const mood = 0.8 + this.happiness / 250;              // happy residents pay willingly (0.8 to 1.2)
    const health = 0.85 + 0.15 * n.health;                 // healthy workers are more productive
    const exportK = this.hwRoads > 0 || this.ports > 0 ? 1 : 0.5;   // without the highway or a sea port, industry can't sell its goods
    this.grant = Math.round(Math.max(0, 300 * (1 - this.pop / 1200)));       // regional grant that tapers off as the town grows
    this.tourIncome = Math.round(this.tourists * 3 * (0.6 + this.tax.c / 22));                                   // visitors pay for rooms, meals and tickets
    // goods: shops pay more for goods bought from the region (and can't get them at all without the highway or a port);
    // factories earn a little more selling to local shops
    const gs = this.goods, shopK = 1 - gs.importShare * (exportK === 1 ? 0.2 : 0.5), localK = 1 + 0.1 * (gs.made > 0 ? gs.local / gs.made : 0);
    // trade with the neighbouring towns: spare power and water sold, garbage sent away for a fee (needs the highway)
    const d = this.uDiag || {}, hwOk = this.hwRoads > 0;
    this.tradeIncome = hwOk ? Math.round((this.trade.power ? (d.pSpare || 0) * TRADE.power : 0) + (this.trade.water ? (d.wSpare || 0) * TRADE.water : 0)) : 0;
    this.tradeCost = hwOk && this.trade.waste ? Math.round((this.wasteOut || 0) * TRADE.waste) : 0;
    const base = this.taxBase ?? this.pop;            // well-off residents pay more tax than working-class ones
    const inc = (base * (this.tax.r / 100) * 22 * mood + this.cJobs * (this.tax.c / 100) * 22 * health * shopK + (this.iTax ?? this.iJobs) * (this.tax.i / 100) * 22 * health * exportK * localK) * served + this.grant + this.tourIncome + this.tradeIncome;
    let wires = 0; for (let i = 0; i < N * N; i++) if (this.w.wire[i]) wires += this.w.wire[i] === 2 ? 0.3 : 0.15;
    let pipes = 0; for (let i = 0; i < N * N; i++) if (this.w.pipe[i]) pipes += 0.1;
    let loanPay = 0;
    for (const l of this.loans) { loanPay += l.pay; l.left--; }
    this.loans = this.loans.filter((l) => l.left > 0);
    const interest = this.money < 0 ? Math.round(-this.money * OVERDRAFT_RATE) : 0;
    this.lastRoadSpend = Math.round(this.roadSpend || 0); this.roadSpend = 0;
    const exp = this.lastRoadSpend + this.roads * 0.4 + (this.avenues || 0) * 0.6 + (this.bridges || 0) * 1.6 + this.parks * 1 * ((this.fund.fun ?? 100) / 100) + n.upkeep + wires + pipes + this.ordCost() + this.tradeCost;
    this.lastIncome = Math.round(inc); this.lastExpense = Math.round(exp); this.lastLoanPay = loanPay; this.lastInterest = interest;
    const net = this.lastIncome - this.lastExpense - loanPay - interest;
    this.money += net;
    this.streak = net > 0 ? this.streak + 1 : 0;
    this.history.push({ d: this.day, pop: this.pop, money: Math.round(this.money), happy: this.happiness, inc: this.lastIncome, exp: this.lastExpense + loanPay + interest });
    if (this.history.length > 240) this.history.shift();
    this.updateCut();
    this.events.push({ type: 'month', income: this.lastIncome, expense: this.lastExpense + loanPay + interest });
    this.monthlyRequests();
    this.monthlyPeople(net);
    this.headline();
  }
  // ---- 0.8.6: ages, approval and the yearly election ----
  monthlyPeople(net) {
    // ages: children grow up, adults grow old, seniors pass on (later with good health care); newcomers are mostly young
    const a = { ...this.ages }, hc = this.net.health || 0, pop = this.pop, prev = this.prevPop || pop;
    const births = a.adults * 0.0016, up = a.kids / 216, old = a.adults / 540, gone = a.seniors / (130 * (1 + hc));
    a.kids += births - up; a.adults += up - old; a.seniors += old - gone;
    if (pop > prev && pop > 0) { const f = Math.min(0.5, (pop - prev) / pop); a.kids = a.kids * (1 - f) + 0.3 * f; a.adults = a.adults * (1 - f) + 0.64 * f; a.seniors = a.seniors * (1 - f) + 0.06 * f; }
    const t = a.kids + a.adults + a.seniors; for (const k in a) a[k] = clamp(a[k] / t, 0.04, 0.9);
    this.ages = a; this.prevPop = pop;
    // approval: how residents rate the mayor. Happiness counts most, then jobs and the city's books
    const unemp = this.workforce > 0 ? Math.max(0, this.workforce - this.cJobs - this.iJobs) / this.workforce : 0;
    const target = 0.75 * this.happiness + 15 * (1 - Math.min(1, unemp * 4)) + (this.money < 0 ? 0 : net >= 0 ? 10 : 5);
    this.approval = Math.round(clamp(this.approval * 0.7 + target * 0.3, 0, 100));
    if (this.taxCap && this.day >= this.taxCap.until) { this.taxCap = null; this.pushNews('The council hands tax decisions back to the mayor'); }
    // election every January, from the second year on
    if (this.month === 0 && this.day >= 360 && pop >= 50) {
      const won = this.approval >= 50, year = this.year;
      if (won) {
        const prize = Math.round(500 + pop * 0.8);
        this.money += prize; this.moods.push({ v: 3, until: this.day + 180 });
        this.pushNews(`Mayor re-elected with ${this.approval}% approval. The region adds a ${fmt$(prize)} grant`);
      } else {
        this.taxCap = { until: this.day + 360, cap: 9 }; this.moods.push({ v: -2, until: this.day + 120 });
        for (const k of ['r', 'c', 'i']) if (this.tax[k] > 9) this.tax[k] = 9;
        this.pushNews(`Mayor loses the vote with ${this.approval}% approval. The council caps taxes at 9% for a year`);
      }
      this.lastVote = { year, won, approval: this.approval };
      this.events.push({ type: 'vote', won, approval: this.approval });
      this.recount();
    }
  }
  nextVote() { const y = Math.max(this.year + 1, 2027); return `Jan ${y}`; }
  setFund(k, v) { if (!FUND_GROUPS.includes(k)) return; this.fund[k] = clamp(Math.round(v / 10) * 10, 50, 150); this.needAn = true; }
  setTrade(k, on) { if (!(k in this.trade)) return; this.trade[k] = !!on; this.needAn = true; }
  // a household in a home: a name, their working day, and what they wish the city had
  family(i) {
    const w = this.w, x = i % N, y = (i / N) | 0, l = this.lvl(i);
    const name = SURNAMES[Math.floor(hash(x, y, 31) * SURNAMES.length) % SURNAMES.length];
    const size = 2 + Math.floor(hash(x, y, 37) * 4);
    let best = -1, bd = 99;                          // the nearest workplace, as the crow flies
    for (let r = 1; r <= 18 && best < 0; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const xx = x + dx, yy = y + dy; if (!w.inb(xx, yy)) continue;
      const q = yy * N + xx, k = w.kind[q]; if ((k === T.COM || k === T.IND) && this.lvl(q) && !this.aband[q]) { const dd = Math.hypot(dx, dy); if (dd < bd) { bd = dd; best = q; } }
    }
    const job = best < 0 ? null : (() => { const k = w.kind[best], sp = specOf(w, best); return (sp ? SPEC_TITLE[sp][this.lvl(best)] : LEVEL_NAME[k][this.lvl(best)]).toLowerCase(); })();
    const wishes = [];
    const c = this.cov;
    if (c.health[i] < 0.3) wishes.push(['health', 1 - c.health[i]]); if (c.edu[i] < 0.3) wishes.push(['edu', 1 - c.edu[i]]); if (c.police[i] < 0.3) wishes.push(['police', 0.8 - c.police[i]]);
    if (c.fun[i] < 0.3) wishes.push(['fun', 0.9 - c.fun[i]]); if (c.fire[i] < 0.3) wishes.push(['fire', 0.6 - c.fire[i]]); if (c.transit[i] < 0.2) wishes.push(['transit', 0.4]);
    if (this.poll[i] > 20) wishes.push(['poll', this.poll[i] / 30]); if (this.crime[i] > 30) wishes.push(['crime', this.crime[i] / 40]); if (this.jam[i] > 0.3) wishes.push(['jam', this.jam[i]]);
    if (!this.jobReach[i]) wishes.push(['commute', 2]);
    wishes.sort((p, q) => q[1] - p[1]);
    const wt = wealthOf(this.landValue(i, T.RES));
    return { name: `The ${name} family`, size, wealth: WEALTH_NAME[wt], job: job ? `At the ${job}, ${Math.max(1, Math.round(bd))} tiles ${compass(x, y, best % N, (best / N) | 0) || 'away'}` : 'No job nearby', wish: wishes.length ? `Wishes for ${WISH[wishes[0][0]]}` : 'Happy with the neighbourhood', ok: !wishes.length, l };
  }
  // why each kind of zone wants (or doesn't want) to grow, in plain words
  demandWhy() {
    const jobs = this.cJobs + this.iJobs, pop = this.pop, gs = this.goods, out = {};
    out.r = this.rd > 0.04 ? (jobs > pop * WORK_SHARE ? 'Jobs are waiting for workers' : 'People like the city') : (jobs < pop * WORK_SHARE ? 'Not enough jobs. Shops and industry need to grow first' : this.happiness < 50 ? 'People aren\u2019t happy here' : 'Taxes are putting people off');
    out.c = this.cd > 0.04 ? (gs.importShare < 0.3 ? 'Customers want more shops, and local factories supply them' : 'Customers want more shops') : (this.hwRoads === 0 ? 'Shops need the highway' : 'Not enough customers yet. More homes bring more shoppers');
    out.i = this.id > 0.04 ? (gs.need > gs.made ? 'Shops need more goods' : 'Workers want factory jobs') : (this.hwRoads === 0 && !this.ports ? 'Industry needs the highway or a sea port' : 'Not enough workers yet. More homes bring more workers');
    return out;
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
    const n = this.net, out = [], add = (who, sev, text, view, news, tile) => out.push({ who, sev, text, view, news, tile });
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
    { // plenty in total but not reaching buildings: say why (uDiag from anNetworks)
      const u = this.uDiag || {}, at = (k) => (u.at && u.at[k]) || undefined, list = (a) => (a.length > 2 ? `${a.slice(0, 2).join(', ')} and ${a.length - 2} more` : a.join(' and '));
      if (u.pLoose && u.pLoose.length) add('Utilities', 'bad', `${list(u.pLoose)} ${u.pLoose.length > 1 ? 'aren\u2019t' : 'isn\u2019t'} touching a power line, so ${u.pLoose.length > 1 ? 'their' : 'its'} power goes nowhere. Run a line next to it.`, 'power', undefined, at('pLoose'));
      if (u.pShort > 0 && u.pSpare >= u.pShort * 0.5) add('Utilities', 'warn', `Your power lines form separate networks. One has ${Math.round(u.pSpare)} spare while another is short by ${Math.round(u.pShort)}. Join the lines so power can reach everyone.`, 'power');
      if (u.pNoLine > 2) add('Utilities', 'warn', `${u.pNoLine} buildings are more than 2 tiles from a power line. The power view shows them in red.`, 'power', undefined, at('pNoLine'));
      if (u.wLoose && u.wLoose.length) add('Utilities', 'bad', `${list(u.wLoose)} ${u.wLoose.length > 1 ? 'aren\u2019t' : 'isn\u2019t'} touching a pipe, so ${u.wLoose.length > 1 ? 'their' : 'its'} water goes nowhere. Lay a pipe next to it.`, 'water', undefined, at('wLoose'));
      if (u.pumpsDark) add('Utilities', 'warn', `${u.pumpsDark === 1 ? 'A water pump has no power and pumps' : u.pumpsDark + ' water pumps have no power and pump'} only 30%. Put a power line next to ${u.pumpsDark === 1 ? 'it' : 'them'}.`, 'power', undefined, at('pumpsDark'));
      if (u.wShort > 0 && u.wSpare >= u.wShort * 0.5) add('Utilities', 'warn', `Your pipes form separate networks. One has ${Math.round(u.wSpare)} water spare while another is short by ${Math.round(u.wShort)}. Join the pipes.`, 'water');
      if (u.wNoPipe > 2) add('Utilities', 'warn', `${u.wNoPipe} buildings are more than 2 tiles from a water pipe. The water view shows them in red.`, 'water', undefined, at('wNoPipe'));
      if (u.wOut > 2) add('Utilities', 'warn', `${u.wOut} buildings are out of reach of every landfill and recycling center. Build one closer to them, or a transfer station that trucks their garbage to one with room.`, 'waste', undefined, at('wOut'));
      if (u.xNoRoad) add('Utilities', 'bad', `${u.xNoRoad === 1 ? 'A transfer station isn\u2019t' : u.xNoRoad + ' transfer stations aren\u2019t'} next to a road, so the garbage can\u2019t leave. Build a road beside ${u.xNoRoad === 1 ? 'it' : 'them'}.`, 'waste', undefined, at('xNoRoad'));
      if (u.xNoDest) add('Utilities', 'bad', `${u.xNoDest === 1 ? 'A transfer station has' : u.xNoDest + ' transfer stations have'} no road to any landfill or recycling center. Join the roads, or put a road next to the waste building.`, 'waste', undefined, at('xNoDest'));
      if (u.xStuck > 2) add('Utilities', 'warn', `Transfer stations have nowhere to send the garbage of ${u.xStuck} buildings: every waste building they reach by road is full. Build a recycling complex or another landfill on the same roads.`, 'waste', undefined, at('xStuck'));
      else if (u.wFull > 2) add('Utilities', 'warn', `The landfills and recycling centers near ${u.wFull} buildings are full. Build another one close by, or a transfer station to send the garbage to one with room.`, 'waste', undefined, at('wFull'));
    }
    if (n.wasteUn > 0.15) add('Utilities', 'warn', `Garbage isn\u2019t collected from ${Math.round(n.wasteUn * 100)}% of buildings. Build a landfill or recycling center in range, or a transfer station.`, 'waste', 'Garbage piles up on city streets');
    { // sewage (0.9.0)
      const sw = this.sewage;
      if (sw && sw.total > 60 && sw.total - sw.treated > Math.max(40, sw.total * 0.15)) {
        const o = sw.outs.slice().sort((p, q) => q.amt - p.amt)[0], where = o ? compass(48, 48, o.x, o.y) : '';
        add('Utilities', sw.treated > 0 ? 'warn' : 'bad', `Sewage from ${sw.buildings} buildings goes untreated ${o && o.water ? `into the water${where ? ` in the ${where}` : ''}` : 'into a ditch'}, polluting it${o && o.water ? ' and spoiling beaches nearby' : ''}. Build a Sewage works touching the pipes (it also sends clean water back).`, 'water', 'Sewage spill fouls the waterfront', o ? { x: o.x, y: o.y } : undefined);
      }
      const pi = this.plantInfo; if (pi) for (const [i, o] of pi) { const def = BT[this.w.bt[i]]; if (def && def.power && o.out < def.power * 0.5 && def.key !== 'solar' && def.key !== 'wind') { add('Utilities', 'bad', `The ${def.name.toLowerCase()} makes only ${Math.round(o.out)} of ${def.power}: ${o.note.charAt(0).toLowerCase() + o.note.slice(1)}.`, 'power', undefined, { x: i % N, y: (i / N) | 0 }); break; } }
    }
    { // metro (0.8.12): separate parts, stations not linked, and where a line would help
      const net = this.metroNet;
      if (net && net.st.length) {
        const lone = net.st.filter((q) => !q.links.length);
        if (lone.length) add('Transport', 'warn', `${lone.length === 1 ? `${lone[0].name} station isn\u2019t` : `${lone.length} metro stations aren\u2019t`} linked to another station, so no trains run there. Pick Transit \u2192 Tunnel, tap it, then tap another station.`, 'metro', undefined, { x: lone[0].x, y: lone[0].y });
        const parts = net.compSize.filter((c) => c >= 2).length;
        if (parts >= 2) { const a2 = net.st.find((q) => q.comp === 0 && q.links.length), b2 = net.st.find((q) => q.comp === 1 && q.links.length); if (a2 && b2) add('Transport', 'tip', `Your metro is in ${parts} separate parts, so people can\u2019t ride from one to the other. Linking ${a2.name} to ${b2.name} would join them.`, 'metro', undefined, { x: a2.x, y: a2.y }); }
      }
      const ar = (this.metroArrows || [])[0];
      if (ar && this.isUnlocked('metro') && ar.n >= 60) add('Transport', 'tip', `About ${ar.n} residents ${compass(48, 48, ar.fx, ar.fy) ? `in the ${compass(48, 48, ar.fx, ar.fy)}` : 'in the middle of the city'} have no jobs within reach. A metro line from there to the jobs ${compass(ar.fx, ar.fy, ar.tx, ar.ty) || 'nearby'} would bring them in reach. Views \u2192 Metro shows where.`, 'metro', undefined, { x: Math.round(ar.fx), y: Math.round(ar.fy) });
    }
    { const rs = this.roadStats; if (rs && rs.roads >= 30 && rs.worn > Math.max(4, rs.roads * 0.08)) { const wt = rs.worst >= 0 ? { x: rs.worst % N, y: (rs.worst / N) | 0 } : undefined; add('Transport', rs.worn > rs.roads * 0.2 ? 'bad' : 'warn', `${rs.worn} road tiles are worn out and only ${rs.crews} repair crew${rs.crews > 1 ? 's are' : ' is'} working on them. Worn roads slow traffic and the worst have to close. Raise the Road repairs budget in City \u2192 Services, or tap a road to repair it now.`, 'traffic', 'Potholes everywhere as road crews fall behind', wt); } }
    if (n.jamAvg > 0.2) add('Transport', 'warn', 'Traffic jams are slowing commutes and lowering land value. Add bus stops and a terminal, or build a second route.', 'traffic', 'Rush hour gridlock frustrates commuters');
    { // the worst bottlenecks by name (flow.js finds stretches of jammed road), with a button that goes there
      const necks = (this.flowM.necks || []).filter((b) => b.load > 1.1).slice(0, 2);
      if (necks.length) {
        let px = 0, py = 0, pw = 0; for (let q = 0; q < N * N; q++) if (this.w.kind[q] === T.RES && this.w.level[q]) { px += q % N; py += (q / N) | 0; pw++; }
        const ox = pw ? px / pw : N / 2, oy = pw ? py / pw : N / 2;
        necks.forEach((b, k) => {
          const dir = compass(ox, oy, b.cx, b.cy), what = b.kind === 'bridge' ? 'bridge' : b.kind === 'avenue' ? 'avenue' : 'street';
          const fix = b.kind === 'bridge' ? 'A second bridge nearby would share the load.' : b.kind === 'avenue' ? 'It is already an avenue: build a parallel route, or add buses or a metro so fewer people drive.' : 'Widen it to an avenue, or build a road alongside it.';
          add('Transport', k ? 'tip' : 'warn', `${k ? 'Next worst' : 'Worst'} bottleneck: ${b.tiles > 15 ? 'a long stretch' : `${b.tiles} tile${b.tiles > 1 ? 's' : ''}`} of ${what}${b.by ? ` by the ${b.by}` : ''}${dir ? `, ${dir} of the town centre` : ' in the town centre'}. At rush hour it carries ${b.trips} trips where ${b.cap} fit. ${fix}`, 'traffic', k ? null : 'Drivers name the city\u2019s worst bottleneck', { x: b.x, y: b.y });
        });
      }
    }
    if (n.crimeAvg > 28 && this.pop > 200) add('Safety', 'warn', 'Crime is rising in busy neighborhoods. Build police stations near homes.', 'crime', 'Break-ins rise downtown');
    if (n.fire < 0.3 && this.pop > 300) add('Safety', 'tip', 'Much of the city has no fire station in range. Fires there spread fast.', 'fire');
    if (n.pollAvg > 22) add('Health', 'warn', 'Pollution is hurting residents. Keep industry away from homes and plant parks between them.', 'pollution', 'Smog alert: residents told to stay indoors');
    if (n.health < 0.35 && this.pop > 300) add('Health', 'warn', 'Few residents have a clinic or hospital nearby. Sick workers mean less tax income.', 'health');
    const offices = this.w.level.some((l, i) => l === 2 && (this.w.kind[i] === T.COM || this.w.kind[i] === T.IND));
    if (offices && n.edu < 0.25) add('Education', 'warn', 'Offices and factories can\u2019t grow without educated workers. Build schools near homes.', 'edu');
    if (this.isUnlocked('sky') && !this.hasUni) add('Education', 'tip', 'Office megatowers and hi-tech campuses need a university.', 'edu');
    if (this.happiness < 45) { const worst = this.hapParts.find((p) => p[1] < 0); add('People', 'bad', `Residents are unhappy (${this.happiness}%)${worst ? `. Biggest complaint: ${worst[0].toLowerCase()}` : ''}. Unhappy residents move away.`, null, 'Families pack up and leave town'); }
    { // buildings held back because only a dirt track reaches them: point at the biggest group
      const w = this.w, held = [];
      for (let i = 0; i < N * N; i++) { const k = w.kind[i]; if ((k === T.RES || k === T.COM || k === T.IND) && w.level[i] >= TRACK_MAX && w.level[i] < MAX_LEVEL && !this.fronts(i) && this.zoneDemand(k) > 0.04 && /road next to it/.test(this.blocker(i, k, w.level[i]) || '')) held.push(i); }
      if (held.length >= 4) {
        const set = new Set(held); let best = held[0], bn = -1;
        for (const i of held) { const x = i % N, y = (i / N) | 0; let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (set.has((y + dy) * N + x + dx)) n++; if (n > bn) { bn = n; best = i; } }
        add('Planning', 'tip', `${held.length} buildings could grow taller, but only a dirt track reaches them. A street through the block, next to them, lets them grow. Show on map goes to the biggest group.`, null, null, { x: best % N, y: (best / N) | 0 });
      }
    }
    if (this.rd > 0.5) add('Planning', 'tip', 'People want to move here. Zone more homes.');
    if (this.bld.empty >= 3) add('Planning', this.bld.empty >= 12 ? 'warn' : 'tip', `${this.bld.empty} buildings stand empty. Tap one to see why its people left. They come back once the problem is fixed.`, null, 'Boarded-up buildings worry the neighbours');
    { const unemp = this.workforce > 0 ? Math.max(0, this.workforce - jobs) / this.workforce : 0;
      if (unemp > 0.12 && this.pop >= 100) add('Jobs', 'warn', `${Math.round(unemp * 100)}% of workers can\u2019t find a job. Zone shops and industry close to homes.`, 'commute', 'Job centre queues grow as unemployment rises'); }
    if (this.goods.need > 40 && this.goods.importShare > 0.5) add('Industry', 'tip', `Shops import ${Math.round(this.goods.importShare * 100)}% of their goods, which eats into their profits. More industry would supply them locally.`);
    if (this.approval < 50 && this.day >= 300) add('Mayor', 'warn', `Approval is ${this.approval}%. Below 50% at the January election, the council caps taxes at 9% for a year. Happier residents, jobs and a healthy budget raise it.`);
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
      const fm = this.flowM, ld = fm.load[i], hw = this.roadLinked(i);
      const br = w.terrain[i] === TERRAIN.WATER;
      const av = !br && w.level[i] === 1;
      const rows = [row('Traffic', w.fix && w.fix[i] === 2 ? 'None: closed, drivers go round' : `${ld > 1.1 ? 'Jammed' : ld > 0.7 ? 'Busy' : 'Light'}: ${Math.round(fm.flow[i])} of ${Math.round(fm.capOf(i))} trips`, ld <= 1.1), row('Reaches the highway', yes(hw), hw)];
      const jt = junctionType(w, x, y);
      if (jt === SIGNAL) {
        const s = greenShare(w, x, y), G = CYCLE - 3, gv = Math.round(Math.max(3.5, Math.min(G - 3.5, G * s))), gh = G - gv;
        rows.push(row('Junction', gv === gh ? `Traffic lights, ${gv} s of green each way` : `Traffic lights: ${Math.max(gv, gh)} s of green for the busier road, ${Math.min(gv, gh)} s for the other`));
      } else if (jt) rows.push(row('Junction', `Main road ${jt === PRI_V ? '\u2197\u2199' : '\u2196\u2198'}: side roads give way`));
      let action = null, actions = null;
      if (jt) {                                           // choose it by hand: lights, or which road goes first
        const fx = this.jfix[i]; if (fx) rows[rows.length - 1].value += ' (set by you)';
        actions = [['auto', 'Automatic', !fx], ['sig', 'Lights', fx === SIGNAL], ['v', 'Main \u2197\u2199', fx === PRI_V], ['h', 'Main \u2196\u2198', fx === PRI_H]].map(([id, label, on]) => ({ id: 'jn:' + id, label, on }));
      }
      if (!w.hw[i] && w.wear) {                           // condition and repairs (0.9.0)
        const wr = w.wear[i], fx = w.fix[i], rp = this.repairs.get(i);
        rows.splice(1, 0, row('Condition', fx === 2 ? `Closed for a big repair, ${rp ? rp.left : 1} more day${rp && rp.left > 1 ? 's' : ''}` : fx === 1 ? `One lane closed for repairs, ${rp ? rp.left : 1} more day${rp && rp.left > 1 ? 's' : ''}` : wr >= BIG_AT ? 'Falling apart: it will have to close for repairs' : wr >= REPAIR_AT ? 'Worn out: waiting for a repair crew' : wr >= 60 ? 'Cracked: a little slower' : wr >= 30 ? 'Fair' : 'Good', fx ? null : wr < 60));
        if (wr >= 30 || fx) actions = (actions || []).concat([{ id: 'rd:now', label: `Repair now (${fmt$(repairNowCost(w, i))})` }]);
      }
      if (hw && !w.hw[i]) {                                                          // where this road's trips come from and go to
        const pr = fm.probeFor(i), pct = (v) => Math.round((v / pr.total) * 100);
        if (!pr || (!pr.done && pr.total <= 0)) rows.push(row('Trips', 'Tracing routes\u2026'));
        else if (pr.total < 0.5) rows.push(row('Trips', 'No regular trips use this road yet'));
        else {
          const why = [['work', pr.why[0]], ['shops', pr.why[1]], ['lorries', pr.why[2]]].filter((p) => pct(p[1]) >= 1).map((p) => `${p[0]} ${pct(p[1])}%`);
          const where = (arr) => {
            let n = 0, best = -1; for (let d = 0; d < arr.length; d++) { if (arr[d] / pr.total >= 0.05) n++; if (best < 0 || arr[d] > arr[best]) best = d; }
            const bx = (best % DISTRICTS) * DISTRICT + DISTRICT / 2, by = ((best / DISTRICTS) | 0) * DISTRICT + DISTRICT / 2, dir = compass(x, y, bx, by), far = Math.round(Math.hypot(bx - x, by - y));
            return `${Math.max(1, n)} area${n > 1 ? 's' : ''}; most ${dir ? `${far} tiles ${dir}` : 'close by'} (${pct(arr[best])}%)`;
          };
          rows.push(row('Trips for', why.join(' \u00b7 ')), row('Coming from', where(pr.from)), row('Going to', where(pr.to)));
          action = { id: 'trips', label: 'Show trips on map', hint: 'Blue: where these trips start. Orange: where they go.' };
        }
      }
      return { x, y, w: 1, d: 1, title: w.hw[i] ? 'Highway' : br ? 'Bridge' : av ? 'Avenue' : 'Road', sub: w.hw[i] ? 'Links the city to the region' : br ? 'Upkeep $2/month' : av ? 'Carries twice the traffic of a street. Upkeep $1/month' : 'Upkeep $0.40/month. Pick Avenue and drag over it to widen it',
        rows, action, actions };
    }
    if (k === T.SVC) {
      const ax = x - (w.bo[i] & 3), ay = y - (w.bo[i] >> 2), a = w.idx(ax, ay), def = BT[w.bt[i]], shut = this.closed(def), building = this.pending.has(a);
      const rows = []; let actions;
      rows.push(row('Status', building ? 'Under construction' : shut ? 'Closed (city in debt)' : 'Open', !building && !shut));
      if (def.use || def.cov) rows.push(row('Power', def.power ? 'Generates' : yes(this.pw[a]), def.power || !!this.pw[a]));
      rows.push(row('Upkeep', fmt$(def.upkeep * (shut ? 0.2 : 1)) + '/month'));
      if (def.power || def.store) {
        const pi = this.plantInfo && this.plantInfo.get(a);
        if (pi && !building) { rows.push(row(def.store ? 'Adds' : 'Power output', `${Math.round(pi.out)}${pi.peak ? ` (up to ${pi.peak})` : def.store ? ` of ${def.store}` : pi.out < def.power ? ` of ${def.power}` : ''}`, pi.out >= (def.store ? 1 : def.power * 0.95) || (pi.peak && pi.out > 0))); if (pi.note) rows.push(row('Why', pi.note)); }
        else if (def.power) rows.push(row('Power output', def.power));
        if (def.key === 'solar' && !building) { const sun = this.sunNow ?? 1; rows.push(row('Right now', sun > 0.05 ? `About ${Math.round((def.peak || def.power) * sun)} in this light` : 'Dark: nothing until morning', sun > 0.05)); }
      }
      if (def.water) rows.push(row('Water output', def.water + (def.use && !this.pw[a] ? ' (30% without power)' : '')));
      if (def.waste) {
        const fl = this.facLoad && this.facLoad.get(a);
        if (fl && !building) {
          rows.push(row('Garbage', `${Math.round(fl.load)} of ${Math.round(fl.cap)} in use`, fl.load < fl.cap * 0.97));
          if (fl.via) rows.push(row('From transfer stations', Math.round(fl.via)));
          if (fl.cap < def.waste) rows.push(row('Capacity', `${def.waste} (30% without power)`, false));
        } else rows.push(row('Garbage capacity', def.waste));
      }
      if (def.xfer && !building) {
        const xi = this.xferInfo && this.xferInfo.get(a);
        if (xi) {
          rows.push(row('Collects from', `${def.radius} tiles around`));
          if (!xi.road) rows.push(row('Road', 'None next to it: the garbage can\u2019t leave', false));
          else if (!xi.dests.length) rows.push(row('Sends garbage to', 'Nothing: no landfill or recycling center on its roads', false));
          else {
            const used = xi.dests.filter((t) => t.amt > 0);
            rows.push(row('Buildings served', xi.served, xi.served > 0 ? true : null));
            if (used.length) for (const t of used.slice(0, 3)) rows.push(row('Sends to', `${t.name}, ${t.dist} tiles by road (${Math.round(t.amt)})`, true));
            else rows.push(row('Sends to', `${xi.dests[0].name} when needed, ${xi.dests[0].dist} tiles by road`, null));
            if (used.length > 3) rows.push(row('And', `${used.length - 3} more`));
          }
          if (xi.stuck) rows.push(row('Not collected', `${xi.stuck} building${xi.stuck > 1 ? 's' : ''}: every waste building it reaches is full`, false));
        }
      }
      if (def.cov) rows.push(row('Serves', `${def.radius} tiles around`));
      if (def.sewer && !building) {
        const si = this.sewInfo && this.sewInfo.get(a);
        if (si) { if (!si.piped) rows.push(row('Pipes', 'Not touching a pipe: nothing reaches it', false)); else { rows.push(row('Cleans', `${si.load} of ${si.cap} sewage`, si.load < si.cap)); rows.push(row('Returns', `${si.back} clean water to its pipes`, true)); } }
      }
      if (def.shore && !building && this.dirtyWater) { const c = this.shoreClean({ x: ax, y: ay, def }); if (c < 0.95) rows.push(row('Water', `Dirty with sewage: ${Math.round((1 - c) * 100)}% fewer visitors`, false)); }
      if (def.metro && !building) {
        const ms = this.metroNet && this.metroNet.by.get(a);
        if (ms) {
          rows.unshift(row('Station', ms.name));
          const nm = (i2) => this.stationName(i2);
          rows.push(row('Tunnels to', ms.links.length ? ms.links.map((l) => `${nm(l.to)} (${Math.round(l.len)})`).join(', ') : 'None yet: pick Transit \u2192 Tunnel, tap this station, then another', ms.links.length > 0));
          if (ms.links.length) {
            const size = this.metroNet.compSize[ms.comp];
            rows.push(row('Network', `${size} station${size > 1 ? 's' : ''}${this.metroNet.compSize.length > 1 ? `, line ${ms.comp + 1} of ${this.metroNet.compSize.length} separate parts` : ''}${ms.links.length >= 3 ? ' \u00b7 interchange' : ''}`, true));
            rows.push(row('Each morning', `${Math.round(ms.board)} get on here, ${Math.round(ms.alight)} get off`, ms.board + ms.alight > 0 ? true : null));
          }
          if (!this.pw[a]) rows.push(row('Trains', 'Not running: the station has no power', false));
          actions = ms.links.map((l) => ({ id: `mx:${a}:${l.to}`, label: `Remove tunnel to ${nm(l.to)}` }));
        }
      }
      if (def.ferry && !building && !shut) { const nf = (this.ferryLinks && this.ferryLinks.get(a)) || 0; rows.push(row('Ferry route', nf ? `Yes, to ${nf} other pier${nf > 1 ? 's' : ''}` : 'No, needs a second ferry pier on the same water', nf > 0)); }
      if (def.pollute) rows.push(row('Pollution', 'Yes', false));
      return { x: ax, y: ay, w: def.w, d: def.d, title: def.name, sub: shut ? 'Reopens when the city is out of debt' : '', rows, actions, why: shut ? 'Closed to save money while the city owes the bank' : null };
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
        ...(l ? [row('Access', this.fronts(i) ? 'On a road' : this.trackLot[i] ? `Dirt track, grows to level ${TRACK_MAX}` : `No road next to it, grows to level ${TRACK_MAX}`, this.fronts(i) ? true : l >= TRACK_MAX ? false : null)] : []),
        row(res ? 'Jobs within reach' : 'Workers within reach', reach ? (c < 1 ? 'Yes, right nearby' : c < 255 ? `Yes, ${Math.round(c)} tiles away` : 'Yes') : 'No', !!reach),
        ...(l && this.metroVia[i] >= 0 && this.metroNet ? [(() => { const v = this.metroVia[i], A = this.metroNet.st[(v / 1024) | 0], B = this.metroNet.st[v % 1024], S = this.metroStops && (res ? this.metroStops.toJob : this.metroStops.toHome), n = S ? S.stops[(v / 1024) | 0] : 0; return row(res ? 'Gets to work by' : 'Workers come by', A && B ? `Metro, ${A.name} to ${B.name}${n ? `, ${n} stop${n > 1 ? 's' : ''}` : ''}` : 'Metro', true); })()] : []),
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
      if (l && !building) {
        const emp = this.aband[i];
        if (emp) rows.unshift(row('Status', `Standing empty: ${ABANDON_WHY[emp]}`, false));
        if (res && !emp) { const f = this.family(i); rows.unshift(row('Neighbours', `${f.name} \u00b7 ${f.wealth}`), row('Work', f.job, f.job !== 'No job nearby'), row('Their wish', f.wish, f.ok)); }
        if (k === T.COM && !emp) { const gs = this.goods; rows.push(row('Goods on the shelves', gs.need <= 0 ? 'Local' : gs.importShare < 0.05 ? 'All from local factories' : gs.importShare > 0.95 ? (this.hwRoads ? 'All imported from the region' : 'Hard to get (no highway)') : `${Math.round((1 - gs.importShare) * 100)}% local, the rest imported`, gs.importShare < 0.5)); }
        if (k === T.IND && !emp) { const gs = this.goods; rows.push(row('Goods go to', gs.made <= 0 ? 'Nowhere yet' : gs.local >= gs.made * 0.95 ? 'Local shops' : gs.local <= gs.made * 0.05 ? 'The region' : `Local shops (${Math.round((gs.local / gs.made) * 100)}%) and the region`, true)); }
      }
      const spc = specOf(w, i);
      if (spc) rows.splice(0, 0, row('Industry type', ['', 'Farm: few jobs, little pollution', 'Forestry: some pollution', 'Tech: many jobs, clean, high tax'][spc], true));
      const title = l ? (spc ? SPEC_TITLE[spc][l] : shr ? WF_NAME[shr][k][l] : LEVEL_NAME[k][l]) : `${ZONE_NAME[k]} zone (empty lot)`;
      const sub = l ? `${wf ? wf + '  \u00b7  ' : ''}Level ${l} of ${MAX_LEVEL}  \u00b7  ${this.aband[i] && !building ? `empty (room for ${cap} ${res ? 'residents' : 'jobs'})` : `${cap} ${res ? 'residents' : 'jobs'}`}` : wf ? `${wf}: waiting for someone to build here` : 'Waiting for someone to build here';
      return { x, y, w: 1, d: 1, title, sub, rows, why: why || (l >= MAX_LEVEL ? 'Fully grown' : l ? 'Ready to grow' : 'Ready to build'), good: !why };
    }
    const shrO = w.shore[i];
    return { x, y, w: 1, d: 1, title: w.tree[i] ? 'Woods' : 'Open land', sub: shrO ? `Waterfront (${SHORE_NAME[shrO].toLowerCase()}): free to build` : 'Free to build', rows: [row('Land value', lvRaw, lvRaw >= 46), row('Pollution', Math.round(this.poll[i]), this.poll[i] < 25), row('Crime', Math.round(this.crime[i]), this.crime[i] < 30)] };
  }
  // What a power plant makes now and why (0.9.0). `vari` is the part of sun and wind a battery can make up for.
  plantOutput(a) {
    const w = this.w, def = a.def, k = def.key;
    let nearWater = false, pipe = false, road = false;
    for (let y = a.y - 2; y < a.y + def.d + 2; y++) for (let x = a.x - 2; x < a.x + def.w + 2; x++) { if (!w.inb(x, y)) continue; const q = y * N + x; if (w.terrain[q] === TERRAIN.WATER && w.kind[q] !== T.ROAD) nearWater = true; }
    for (let y = a.y - 1; y <= a.y + def.d; y++) for (let x = a.x - 1; x <= a.x + def.w; x++) { if (!w.inb(x, y)) continue; const q = y * N + x; if (w.pipe[q]) pipe = true; if (w.kind[q] === T.ROAD) road = road || !this.hwRoadComp || this.hwRoadComp.has(this.roadComp[q]); }
    const cool = (need) => { if (nearWater) return { ok: true, note: 'Cooled by the water next to it' }; if (pipe) { const ok = !this.coolOk || this.coolOk.has(a.i); return { ok, pipe: need, note: ok ? `Cooled with ${need} water from the pipes` : `Its pipes can\u2019t spare ${need} water for cooling` }; } return { ok: false, note: 'No cooling water: build it by a lake or the sea, or lay a pipe to it' }; };
    if (k === 'solar') { const peak = def.peak || def.power, firm = Math.round(peak * 0.5); return { out: firm, peak, vari: peak - firm, note: `${peak} in full sun, nothing at night: ${firm} on average. Batteries on its lines store the rest` }; }
    if (k === 'wind') { const wk = this.windK ?? 0.6, rated = def.peak || def.power, now = Math.round(rated * wk); return { out: now, peak: rated, vari: rated - now, note: wk > 0.85 ? 'Strong wind' : wk > 0.5 ? 'A steady breeze' : 'Little wind right now' }; }
    if (k === 'nuclear') { const c = cool(300); return { out: Math.round(def.power * (c.ok ? 1 : 0.25)), coolPipe: c.pipe, note: c.ok ? c.note : `${c.note} (25% without it)` }; }
    if (k === 'gas') { if (!road) return { out: 0, note: 'No gas: it needs a road linked to the highway, where the gas main runs' }; const c = cool(100); return { out: Math.round(def.power * (c.ok ? 1 : 0.6)), coolPipe: c.pipe, note: c.ok ? `Gas from the highway main. ${c.note}` : `${c.note} (60% without it)` }; }
    if (k === 'coal') return road ? { out: def.power, note: 'Coal comes in by lorry from the highway' } : { out: 0, note: 'No coal: lorries need a road from the highway to it' };
    return { out: def.power * (def.use && !this.pw[a.i] ? 0.3 : 1), note: '' };
  }
  // Beaches, piers and marinas lose their visitors when the water in front of them is dirty with sewage (0.9.0)
  shoreClean(a) {
    const dw = this.dirtyWater; if (!dw) return 1; let m = 0;
    for (let y = a.y - 3; y < a.y + a.def.d + 3; y++) for (let x = a.x - 3; x < a.x + a.def.w + 3; x++) if (x >= 0 && y >= 0 && x < N && y < N) m = Math.max(m, dw[y * N + x]);
    return 1 - 0.75 * Math.min(1, m);
  }
  repairRoad(x, y) { return repairNow(this, this.w.idx(x, y)); }
  // ---- metro network (0.8.12) ----
  canLinkMetro(a, b) { return canLink(this, a, b); }
  linkMetro(a, b) {
    const c = canLink(this, a, b); if (!c.ok) return c;
    if (!this.spend(c.cost)) return { ok: false, why: this.noMoney() };
    (this.metroLinks || (this.metroLinks = [])).push([a, b]);
    this.roadsDirty = true; this.analyze(); return { ok: true, cost: c.cost };
  }
  unlinkMetro(a, b) {
    const n = (this.metroLinks || []).length; this.metroLinks = (this.metroLinks || []).filter(([p, q]) => !((p === a && q === b) || (p === b && q === a)));
    if (this.metroLinks.length === n) return { ok: false };
    this.roadsDirty = true; this.analyze(); return { ok: true };
  }
  stationName(i) { const s = this.metroNet && this.metroNet.by.get(i); return s ? s.name : 'station'; }
  metroPlanFor(fx, fy, tx, ty, roadTiles) { return metroPlan(this, fx, fy, tx, ty, roadTiles); }
  roadLinked(i) { const c = this.roadComp[i]; return c >= 0 && !!this.hwRoadComp && this.hwRoadComp.has(c); }

  // ---- player actions ----
  spend(c, force) { if (this.sandbox) return true; if (!force && this.money < c) return false; this.money -= c; return true; }
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
