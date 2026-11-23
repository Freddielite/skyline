import { Fleet } from './boats.js';
import { Ships } from './ships.js';
import { Movers } from './movers.js';
import { World, N, T, TERRAIN } from './world.js';
import { Sim, COST, SEASON_NAME, FUND_GROUPS, FUND_NAME, TRADE, WEALTH_NAME } from './sim.js';
import { BY_KEY, BT } from './buildings.js';
import { ORD, TUTORIAL, UNLOCK } from './rules.js';
import { SoundEngine } from './audio.js';
import * as saves from './saves.js';
import { Renderer } from './renderer.js';
import { Traffic, Trucks } from './cars.js';
import { Agents } from './agents.js';
import { siteInfo } from './construction.js';
import { Disasters } from './disasters.js';
import { Transit } from './transit.js';
import { Ambient } from './ambient.js';
import { followPass } from './traffic.js';
import { Life } from './life.js';
import { clamp, mulberry32 } from './util.js';
import { spriteBudget, setSeason, getSeason } from './sprites.js';
const SEASON_OF = [2, 2, 3, 3, 3, 0, 0, 0, 1, 1, 1, 2];   // by month: winter Dec-Feb, spring Mar-May (blossom), summer Jun-Aug, autumn Sep-Nov

const SAVE_KEY = 'skyline.save.v1';
const UNDO_MS = 20000;                 // a build can only be undone shortly after you make it
export const TOOL_COST = { avenue: COST.avenue, pipe: COST.pipe, wire: COST.wire, cable: COST.cable, road: COST.road, res: COST.zone, com: COST.zone, ind: COST.zone, park: COST.park, bulldoze: COST.bulldoze };
for (const b of Object.values(BT)) TOOL_COST[b.key] = b.cost;

export class Game {
  constructor(canvas, hooks = {}) {
    this.cv = canvas; this.hooks = hooks;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.tool = null; this.speed = 1; this.timeSetting = 'auto'; this.mode = 0; this.clock = 20;
    this.history = []; this.hitches = []; this.overlay = null; this.preview = null; this.drag = null; this.pointers = new Map(); this.pinch = null; this.pan = null;
    this.acc = 0; this.last = 0; this.running = false; this.dirtySave = false; this.saveTimer = 0;
    this.renderer = new Renderer(canvas, this);
    try { this.quality = localStorage.getItem('skyline.quality') || 'auto'; } catch (e) { this.quality = 'auto'; }
    try { this.seasons = localStorage.getItem('skyline.seasons') === 'off' ? 'off' : 'auto'; } catch (e) { this.seasons = 'auto'; }
    try { const f = localStorage.getItem('skyline.fps'); this.fpsSetting = f === '30' ? 30 : f === '60' ? 60 : 'auto'; } catch (e) { this.fpsSetting = 'auto'; }
    this.fast = this.quality === 'fast'; this.frameAvg = 16; this.slowT = 0; this.runT = 0; this.perf = { n: 0, sum: 0, worst: 0, at: 0, avg: 0, fps: 0, max: 0 };
    this.renderer.resize();
    this.audio = new SoundEngine(); this.selTile = null; this.sel = null; this.lastAlert = 0; this.tutT = 0; this.sceneT = 0;
    this.slot = saves.currentSlot();
    this.hadSave = this.load();
    if (!this.hadSave) this.newCity(Math.floor(Math.random() * 100000), true);
    if (this.sim.tut === 0) this.focusHighway();
    this.bind();
    this.enterMenu();                                // the game opens on the start screen
  }
  initWorldLife(seed) {
    this.transit = new Transit(this.world, this.sim, this.agents, mulberry32(seed + 7));
    this.agents.transit = this.transit;
    this.ambient = new Ambient(this.world, mulberry32(seed + 8));
    this.movers = new Movers(this.world, mulberry32(seed + 9));
    this.fleet = new Fleet(this.world, mulberry32(seed + 10));
    this.ships = new Ships(this.world, mulberry32(seed + 11));
    this.density = new Float32Array(N * N);
    this.sim.traffic = this.density;
    this.traffic.flow = this.sim.flowM; this.agents.flow = this.sim.flowM;   // cars and drivers follow the real trips (flow.js)
  }
  get cars() { return this.traffic.cars.concat(this.agents.drivers, this.transit.buses, this.movers.vans); }
  get people() { return this.agents.walkers; }
  get trucks() { return this.garbage.trucks.concat(this.disasters.responders); }
  // ---------- start screen ----------
  // While the start screen is up the city sits behind it as a moving backdrop: the clock and the simulation
  // stand still, but cars, people and boats keep moving and the camera drifts slowly over the map.
  hasSave() { return !!saves.get(this.slot); }
  // ---------- save slots ----------
  slotLabel(k) { return k.startsWith('auto') ? 'Backup ' + k.slice(4) : 'Slot ' + k.slice(4); }
  listSaves() { return [...saves.SLOTS, ...saves.BACKUPS].map((k) => ({ key: k, label: this.slotLabel(k), backup: k.startsWith('auto'), current: k === this.slot, info: saves.meta(k) })); }
  willReplace() { return !!saves.get(this.slot) && !saves.firstEmptySlot(); }   // a new city goes to a free slot, and only replaces one when all three are full
  saveTo(key) { this.slot = key; saves.rememberSlot(key); return this.save(true); }
  loadFrom(key) {
    const prev = this.slot, backup = key.startsWith('auto');
    if (!saves.get(key)) return false;
    if (backup) saves.backup(this.slot, true);                       // restoring a backup keeps the current city as a backup too
    this.slot = key;
    if (!this.load()) { this.slot = prev; return false; }
    this.slot = backup ? (saves.SLOTS.includes(prev) ? prev : 'slot1') : key; saves.rememberSlot(this.slot);
    this.previewing = false; this.hadSave = true; this.sel = null; this.selTile = null; this.dirtySave = true;
    if (backup) this.save(true);
    return true;
  }
  deleteSave(key) { saves.remove(key); if (key === this.slot) { this.slot = saves.currentSlot(); } }
  exportSave(key) { return saves.exportSave(key); }
  async importSave(text, key) { const r = await saves.importSave(text, key); if (r.ok) this.dirtySave = false; return r; }
  setSandbox(on) {
    const s = this.sim; if (!!s.sandbox === !!on) return;
    s.sandbox = !!on;
    if (on) { s.sbMoney = s.money; s.money = 9999999; } else if (s.sbMoney != null) { s.money = s.sbMoney; s.sbMoney = null; }
    this.dirtySave = true; this.say(on ? 'Sandbox on: unlimited money, everything unlocked' : 'Sandbox off: back to your own budget');
  }
  enterMenu() {
    if (!this.menu) this.camSaved = { ...this.cam };
    this.menu = true; this.setTool(null); this.clearSel(); this.setOverlay && this.setOverlay(null);
    if (!this.previewing && this.hadSave !== false) this.save();
    this.aimMenu();
  }
  aimMenu() {                                       // drift around the middle of the city, or of the map if nothing is built
    const w = this.world; let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < N * N; i++) { const k = w.kind[i]; if ((k === T.RES || k === T.COM || k === T.IND || k === T.SVC) && !w.hw[i]) { sx += i % N; sy += (i / N) | 0; n++; } }
    if (n > 20) this.menuC = { x: sx / n, y: sy / n };
    else {                                          // nothing built yet: show the shore nearest the middle, so there is water in view
      let best = null;
      for (let i = 0; i < N * N; i++) if (w.shore[i]) { const x = i % N, y = (i / N) | 0, d = Math.hypot(x - N / 2, y - N / 2); if (!best || d < best.d) best = { x, y, d }; }
      this.menuC = best ? { x: best.x, y: best.y } : { x: N / 2, y: N / 2 };
    }
    let wx = 0, wy = 0, wn = 0;                      // the middle of all the shores: where a new map's water is
    for (let i = 0; i < N * N; i++) if (w.shore[i]) { wx += i % N; wy += (i / N) | 0; wn++; }
    this.waterC = wn ? { x: wx / wn * 0.8 + N / 10, y: wy / wn * 0.8 + N / 10 } : { x: N / 2, y: N / 2 };
    this.menuT = 0;
  }
  // Show a fresh map of the chosen kind behind the start screen. Nothing is saved until the player starts building.
  previewMap(kind) {
    this.newCity(Math.floor(Math.random() * 100000), true, kind);
    this.previewing = true; this.aimMenu();
  }
  cancelPreview() {
    if (!this.previewing) return;
    this.previewing = false;
    if (this.load()) { this.camSaved = { ...this.cam }; this.hadSave = true; }
    this.aimMenu();
  }
  startNewCity(sandbox) {
    if (saves.get(this.slot)) { const e = saves.firstEmptySlot(); if (e) this.slot = e; }
    saves.rememberSlot(this.slot);
    if (sandbox) this.setSandbox(true);
    this.previewing = false; this.menu = false; this.hadSave = true;
    this.fitCamera(); this.focusHighway(); this.dirtySave = true; this.save();
    this.hooks.toast && this.hooks.toast('New city founded');
  }
  leaveMenu() {
    this.menu = false;
    if (this.camSaved) { this.cam = { ...this.camSaved }; this.clampCam(); }
    this.last = performance.now();
  }
  menuCamera(dt) {
    this.menuT += dt;
    const r = this.renderer, a = this.menuT * 0.035, wide = r.W > 600;
    // a new map is shown zoomed out so its shape (coast, lakes, ponds) reads at a glance; a city is shown closer
    const z = this.previewing ? 0.3 : Math.max(0.7, Math.min(1.1, Math.min(r.W / 900, r.H / 520))), rad = this.previewing ? 7 : 9;
    const c = this.previewing ? this.waterC : this.menuC;
    this.focus(c.x + Math.sin(a) * rad, c.y + Math.cos(a * 0.8) * rad, z);
    if (wide) { this.cam.x += r.W * 0.16; this.clampCam(); }      // keep the subject to the right of the menu
  }
  newCity(seed, silent, kind = 'classic') {
    this.world = new World(seed, kind);
    this.sim = new Sim(this.world); this.sim.defer = true;
    this.traffic = new Traffic(this.world, mulberry32(seed + 3));
    this.sites = new Map(); this.history = []; this.selTile = null; this.sel = null;
    this.agents = new Agents(this.world, mulberry32(seed + 4), (i) => this.sites.has(i));
    this.garbage = new Trucks(this.world, mulberry32(seed + 5), () => this.sim.facilities);
    this.disasters = new Disasters(this); this.initWorldLife(seed);
    this.fitCamera(); this.focusHighway();
    this.dirtySave = true;
    if (!silent) this.hooks.toast && this.hooks.toast('New city founded');
  }
  focus(tx, ty, zoom) {
    const r = this.renderer, z = this.cam.zoom = zoom || this.cam.zoom;
    this.cam.x = r.W / 2 - (tx - ty) * 32 * z; this.cam.y = r.H / 2 - (tx + ty + 1) * 16 * z; this.clampCam();
  }
  highwayEnd() {                                     // the inner tip of the highway, where the player connects
    const w = this.world; let best = null;
    for (let i = 0; i < N * N; i++) if (w.hw[i]) { const x = i % N, y = (i / N) | 0, d = Math.abs(x - N / 2) + Math.abs(y - N / 2); if (!best || d < best.d) best = { x, y, d }; }
    return best;
  }
  focusHighway() { const e = this.highwayEnd(); if (e) this.focus(e.x, e.y, Math.max(this.cam.zoom, 1)); }
  fitCamera() {
    const r = this.renderer;
    const z = clamp(Math.min(r.W / 700, r.H / 430), 0.75, 1.3);
    this.cam.zoom = z;
    this.cam.x = r.W / 2; this.cam.y = r.H / 2 - (N * 16 * z) + 10 * z;
  }
  save(force) {
    if (this.previewing) return false;              // a map being looked at on the start screen is not a city yet
    try {
      const data = JSON.stringify({ v: 1, world: this.world.toJSON(), sim: this.sim.state(), cam: this.cam, clock: this.clock });
      saves.put(this.slot, data, { pop: this.sim.pop, money: this.sim.money, date: this.sim.dateLabel(), sandbox: this.sim.sandbox });
      saves.backup(this.slot, false);
      this.dirtySave = false; return true;
    } catch (e) { return false; }
  }
  load() {
    try {
      const rec = saves.get(this.slot);
      if (!rec) return false;
      const raw = rec.data;
      const o = JSON.parse(raw);
      this.world = World.fromJSON(o.world);
      this.sim = new Sim(this.world, o.sim); this.sim.defer = true;
      this.traffic = new Traffic(this.world, mulberry32(this.world.seed + 3));
      this.sites = new Map();
      this.agents = new Agents(this.world, mulberry32(this.world.seed + 4), (i) => this.sites.has(i));
      this.garbage = new Trucks(this.world, mulberry32(this.world.seed + 5), () => this.sim.facilities);
      this.disasters = new Disasters(this); this.initWorldLife(this.world.seed);
      if (o.cam && !this.world.migrated) this.cam = o.cam; else this.fitCamera();
      this.clock = o.clock || 20;
      return true;
    } catch (e) { return false; }
  }
  setTool(t) { this.tool = t; this.preview = null; this.drag = null; if (t) this.clearSel(); }
  setJunction(x, y, v) { this.sim.setJunction(x, y, v); this.dirtySave = true; this.audio.play('tap'); }
  clearSel() { this.selTile = null; this.sel = null; if (this.overlay === 'trips') this.overlay = null; }
  // Advisors' "Show on map": go to a tile, select it (the Inspector opens) and keep the given view.
  showAt(x, y, view) {
    if (!this.world.inb(x, y)) return;
    this.focus(x, y, Math.max(this.cam.zoom, 1.1));
    this.selTile = { x, y }; const info = this.sim.inspect(x, y); this.sel = info ? { x: info.x, y: info.y, w: info.w, d: info.d } : null;
    if (view !== undefined) this.overlay = view;
  }
  takeLoan(k) { const r = this.sim.takeLoan(k); if (r.ok) { this.audio.play('coin'); this.dirtySave = true; } else { this.audio.play('error'); r.why && this.say(r.why); } return r; }
  repayLoan(k) { const r = this.sim.repayLoan(k); if (r.ok) { this.audio.play('coin'); this.dirtySave = true; this.say('Loan repaid'); } else { this.audio.play('error'); r.why && this.say(r.why); } return r; }
  skipTutorial() { this.sim.skipTutorial(); this.dirtySave = true; }
  // Test tools (hidden in the Menu): jump straight to situations that normally take a long time to reach.
  testTool(k) {
    const s = this.sim;
    if (k === 'cash') s.money += 50000;
    else if (k === 'debt') s.money = -Math.round(s.cutLimit() * 3.5);
    else if (k === 'clear') s.money = Math.max(s.money, 20000);
    else if (k === 'unlock') { s.peakPop = Math.max(s.peakPop, 2500); for (const key in UNLOCK) s.unlocked.add(key); }
    else if (k === 'month') { s.day += 30 - (s.day % 30) - 1; s.tick(); }
    s.updateCut(); s.needAn = true; s.analyze(); this.dirtySave = true;
    this.say({ cash: 'Added $50,000', debt: 'City put deep in debt', clear: 'Debt cleared', unlock: 'Everything unlocked', month: 'Skipped to month end' }[k]);
  }
  setAudio(k, v) { this.audio.set(k, v); }
  setQuality(q) {
    this.quality = q; this.fast = q === 'fast'; this.slowT = 0; this.runT = 0;
    try { localStorage.setItem('skyline.quality', q); } catch (e) { /* ignore */ }
    this.renderer.resize();
  }
  // In Auto, watch the frame rate; if the phone can't keep up, switch to the lighter graphics once.
  watchFrames(dt) {
    if (this.quality !== 'auto' || this.fast || document.hidden) return;
    if (this.lightAt && performance.now() - this.lightAt < 10000) return;   // the change of light makes many new pictures at once
    this.runT += dt; if (this.runT < 4) return;                     // let sprites warm up first
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    this.slowT = this.frameAvg > 30 ? this.slowT + dt : 0;            // under about 33 fps for 3 seconds
    if (this.slowT > 3) { this.fast = true; this.renderer.resize(); this.hooks.quality && this.hooks.quality(); }
  }
  // Frame timing for the test tools readout: average and worst frame over the last 2 seconds.
  trackFrame(ms, now) {
    const p = this.perf; p.n++; p.sum += ms; if (ms > p.worst) p.worst = ms;
    if (now - p.at >= 2000) { p.avg = p.n ? p.sum / p.n : 0; p.fps = p.avg ? 1000 / p.avg : 0; p.max = p.worst; p.n = 0; p.sum = 0; p.worst = 0; p.at = now; }
  }
  hitchInfo() {
    const now = performance.now(), recent = this.hitches.filter((h) => now - h.at < 30000), h = recent[recent.length - 1];
    return { n: recent.length, last: h ? `${h.ms} ms · update ${h.upd} ms · drawing ${h.drw} ms · ${h.made} new pictures · ${h.up} uploads (${h.upKB} KB)${h.rec ? ` · ${h.rec} page refills` : ''}${h.solo ? ` · ${h.solo} big texture updates` : ''}` : '' };
  }
  say(m) { this.hooks.toast && this.hooks.toast(m); }
  sfx(n) { this.audio.play(n); }
  setSpeed(s) { this.speed = s; }
  setTime(s) { this.timeSetting = s; }
  setOverlay(o) { this.overlay = o; }
  setWeather(v) { this.ambient.setting = v; }
  setOrd(k, on) { this.sim.setOrd(k, on); this.dirtySave = true; }
  setDisasters(v) { this.sim.disasters = v; this.dirtySave = true; }
  trigger(k) { this.disasters.trigger(k); }
  stats() {
    const s = this.sim;
    return { seasonName: SEASON_NAME[s.SEASON_NOW], tourists: s.tourists, tourIncome: s.tourIncome, beds: s.beds, attraction: s.attraction, request: s.requestView(), seasons: this.seasons, season: getSeason(), fpsSetting: this.fpsSetting, fpsNow: this.fpsNow, engine: this.renderer.engine, hitches: this.hitchInfo(), pages: this.renderer.ctx.pages ? this.renderer.ctx.pages.length : 0, money: Math.floor(s.money), pop: s.pop, date: s.dateLabel(), rd: s.rd, cd: s.cd, id: s.id, happy: s.happiness, tax: { ...s.tax }, income: s.lastIncome, expense: s.lastExpense, bld: s.bld, roads: s.roads, parks: s.parks, jobs: s.cJobs + s.iJobs, speed: this.speed, mode: this.mode, time: `${String(Math.floor(this.hour)).padStart(2, '0')}:${String(Math.floor((this.hour % 1) * 60)).padStart(2, '0')}`, citizens: this.agents.stats.total, employed: this.agents.stats.employed, tSup: s.net.tSup, tDem: s.net.tDem, wasteUn: s.net.wasteUn, pSup: s.net.pSup, uDiag: s.uDiag || null, pDem: s.net.pDem, wSup: s.net.wSup, wDem: s.net.wDem, upkeep: Math.round(s.net.upkeep), crime: Math.round(s.net.crimeAvg), poll: Math.round(s.net.pollAvg), cov: { police: s.net.police, fire: s.net.fire, health: s.net.health, edu: s.net.edu, fun: s.net.fun }, overlay: this.overlay,
      canUndo: this.history.length, undoLabel: this.history.length ? this.history[this.history.length - 1].label : '', undoLeft: this.history.length ? Math.max(1, Math.ceil((UNDO_MS - (performance.now() - this.history[this.history.length - 1].t)) / 1000)) : 0,
      weather: this.ambient.setting, rain: this.ambient.weather.k, buses: this.transit.buses.length, riders: this.agents.stats.riding, heavyRoads: (() => { let n = 0; const l = this.sim.flowM.load; for (let i = 0; i < l.length; i++) if (l[i] > 1.1) n++; return n; })(),
      grant: s.grant || Math.round(Math.max(0, 300 * (1 - s.pop / 1200))), streak: s.streak, ordCost: s.ordCost(), disastersLevel: s.disasters,
      ords: Object.entries(ORD).map(([key, o]) => ({ key, ...o, on: !!s.ord[key] })), goals: s.goalStatus(),
      alerts: [this.disasters.fires.size ? `Fire x${this.disasters.fires.size}` : '', this.disasters.tornado ? 'Tornado' : '', this.disasters.ufo ? 'UFO' : '', s.cut ? 'In debt: services cut' : ''].filter(Boolean),
      cut: s.cut, closed: s.closedList(), cutLimit: s.cutLimit(), owed: Math.round(s.owed()), interest: s.lastInterest, loanPay: s.lastLoanPay,
      loans: s.loans.map((l) => ({ ...l })), offers: s.loanOffers(), credit: Math.round(s.creditLimit()),
      history: s.history, news: s.news, advice: s.advice, hapParts: s.hapParts, hwRoads: s.hwRoads, peakPop: s.peakPop,
      sandbox: !!s.sandbox, locked: s.sandbox ? {} : Object.fromEntries(Object.entries(UNLOCK).filter(([k]) => !s.unlocked.has(k))),
      tut: s.tut < TUTORIAL.length ? { i: s.tut, n: TUTORIAL.length, id: TUTORIAL[s.tut].id, title: TUTORIAL[s.tut].title, text: TUTORIAL[s.tut].text, cat: TUTORIAL[s.tut].cat, tool: TUTORIAL[s.tut].tool } : null,
      inspect: this.inspectInfo(), audio: this.audio.settings(), quality: this.quality, fast: this.fast, perf: { fps: Math.round(this.perf.fps), avg: Math.round(this.perf.avg), worst: Math.round(this.perf.max) }, jam: s.net.jamAvg, noJobN: s.net.noJobN,
      // 0.8.6: people, goods, budgets, elections and the region
      people: (() => { const jobs = s.cJobs + s.iJobs, wf = s.workforce || 0; return { workforce: wf, jobs, unemployed: Math.max(0, wf - jobs), open: Math.max(0, jobs - wf), unemp: wf > 0 ? Math.max(0, wf - jobs) / wf : 0,
        ages: { ...s.ages }, wealth: (s.wealth || [0, 0, 0]).map((n, k) => ({ name: WEALTH_NAME[k], n })), empty: s.bld.empty || 0, approval: s.approval, nextVote: s.nextVote(), lastVote: s.lastVote, taxCap: s.taxCap ? { cap: s.taxCap.cap, left: Math.max(1, Math.ceil((s.taxCap.until - s.day) / 30)) } : null, why: s.demandWhy() }; })(),
      goodsInfo: { ...s.goods },
      fund: FUND_GROUPS.map((k) => ({ k, name: FUND_NAME[k], v: s.fund[k] })),
      trade: { ...s.trade, income: s.tradeIncome || 0, cost: s.tradeCost || 0, linked: s.hwRoads > 0, pSpare: (s.uDiag && s.uDiag.pSpare) || 0, wSpare: (s.uDiag && s.uDiag.wSpare) || 0, wasteOut: s.wasteOut || 0, rates: TRADE } };
  }
  inspectInfo() {
    if (!this.selTile) return null;
    const info = this.sim.inspect(this.selTile.x, this.selTile.y);
    this.sel = info ? { x: info.x, y: info.y, w: info.w, d: info.d } : null;
    return info;
  }
  inspectAt(p) {
    const t = this.toTile(p.x, p.y);
    if (!this.world.inb(t.x, t.y)) { this.clearSel(); return; }
    const info = this.sim.inspect(t.x, t.y);
    if (this.sel && info && this.sel.x === info.x && this.sel.y === info.y) { this.clearSel(); return; }   // tapping it again closes the card
    this.selTile = t; this.sel = info ? { x: info.x, y: info.y, w: info.w, d: info.d } : null;
    if (this.overlay === 'trips' && !(info && info.action && info.action.id === 'trips')) this.overlay = null;   // trips view belongs to a road
    if (!this.sim.inspected) { this.sim.inspected = true; this.dirtySave = true; }
    this.audio.play('tap');
    this.hooks.inspect && this.hooks.inspect();
  }
  setTax(k, v) { const cap = this.sim.taxCap ? this.sim.taxCap.cap : 20; this.sim.tax[k] = clamp(v, 0, cap); this.sim.recount(); this.dirtySave = true; }
  setFund(k, v) { this.sim.setFund(k, v); this.dirtySave = true; }
  setTrade(k, on) { this.sim.setTrade(k, on); this.audio.play('build'); this.dirtySave = true; }

  // ---------- coordinates ----------
  toTile(px, py) {
    const z = this.cam.zoom, u = (px - this.cam.x) / z, v = (py - this.cam.y) / z;
    return { x: Math.floor((u / 32 + v / 16) / 2), y: Math.floor((v / 16 - u / 32) / 2) };
  }
  zoomAt(px, py, f) {
    const c = this.cam, nz = clamp(c.zoom * f, 0.25, 2.6), k = nz / c.zoom;
    c.x = px - (px - c.x) * k; c.y = py - (py - c.y) * k; c.zoom = nz; this.clampCam();
  }
  clampCam() {
    const c = this.cam, r = this.renderer, z = c.zoom;
    // Any edge of the map can be brought to the middle of the screen, with a little room to spare.
    const half = N * 32 * z, m = 80;
    c.x = clamp(c.x, r.W / 2 - half - m, r.W / 2 + half + m);
    c.y = clamp(c.y, r.H / 2 - half - m, r.H / 2 + 60 * z);
  }

  // ---------- input ----------
  bind() {
    const cv = this.cv;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => this.down(e));
    cv.addEventListener('pointermove', (e) => this.move(e));
    cv.addEventListener('pointerup', (e) => this.up(e));
    cv.addEventListener('pointercancel', (e) => this.up(e, true));
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    this._resize = () => { this.renderer.resize(); };
    window.addEventListener('resize', this._resize);
    // Leaving the app (home button, switching apps, screen off) pauses everything: the loop, the city clock and
    // all sound. Android's WebView keeps audio and timers alive in the background unless we stop them ourselves.
    this._hide = () => this.background(true); this._show = () => { if (!document.hidden) this.background(false); };
    document.addEventListener('visibilitychange', () => (document.hidden ? this._hide() : this._show()));
    window.addEventListener('pagehide', this._hide); window.addEventListener('pageshow', this._show);
    window.addEventListener('blur', this._hide); window.addEventListener('focus', this._show);
    document.addEventListener('pause', this._hide); document.addEventListener('resume', this._show);   // Capacitor app events
  }
  pos(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  down(e) {
    this.cv.setPointerCapture && this.cv.setPointerCapture(e.pointerId); this.lastInput = performance.now();
    const p = this.pos(e); this.pointers.set(e.pointerId, p);
    this.audio.unlock();
    this.tap = this.pointers.size === 1 && !this.tool ? { x: p.x, y: p.y, t: performance.now(), d: 0 } : null;
    if (this.pointers.size === 2) { this.drag = null; this.preview = null; this.pan = null; this.startPinch(); return; }
    if (this.pointers.size > 2) return;
    if (this.tool && e.button === 0) { const t = this.toTile(p.x, p.y); this.drag = { start: t, cur: t }; this.updatePreview(); }
    else this.pan = { x: p.x, y: p.y };
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.lastInput = performance.now();
    const p = this.pos(e); const prev = this.pointers.get(e.pointerId); this.pointers.set(e.pointerId, p);
    if (this.pinch && this.pointers.size === 2) { this.doPinch(); return; }
    if (this.drag) { this.drag.cur = this.toTile(p.x, p.y); this.updatePreview(); }
    else if (this.pan) { if (this.tap) this.tap.d += Math.hypot(p.x - prev.x, p.y - prev.y); this.cam.x += p.x - prev.x; this.cam.y += p.y - prev.y; this.clampCam(); }
  }
  up(e, cancel) {
    const had = this.pointers.has(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!had) return;
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.pan = null; return; }
    if (this.drag && !cancel) this.commit();
    else if (this.pan && this.tap && !cancel && this.tap.d < 8 && performance.now() - this.tap.t < 450) this.inspectAt(this.pos(e));
    this.drag = null; this.preview = null; this.pan = null; this.tap = null;
  }
  startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
  doPinch() {
    const [a, b] = [...this.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    this.cam.x += cx - this.pinch.cx; this.cam.y += cy - this.pinch.cy;
    this.zoomAt(cx, cy, d / this.pinch.d);
    this.pinch = { d, cx, cy };
  }
  dragTiles() {
    const d = this.drag; if (!d) return [];
    const a = d.start, b = d.cur, out = [];
    const def = BY_KEY[this.tool];
    if (def) { for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) out.push({ x: b.x + dx, y: b.y + dy }); return out.filter((p) => this.world.inb(p.x, p.y)); }
    if (this.tool === 'road' || this.tool === 'avenue' || this.tool === 'wire' || this.tool === 'cable' || this.tool === 'pipe') {
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) >= Math.abs(dy)) { const s = Math.sign(dx) || 1; for (let x = a.x; x !== b.x + s; x += s) out.push({ x, y: a.y }); }
      else { const s = Math.sign(dy) || 1; for (let y = a.y; y !== b.y + s; y += s) out.push({ x: a.x, y }); }
    } else {
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y });
    }
    return out.filter((p) => this.world.inb(p.x, p.y));
  }
  updatePreview() {
    const w = this.world, def = BY_KEY[this.tool];
    let tiles;
    if (def) { const ok = this.sim.canPlaceBuilding(this.tool, this.drag.cur.x, this.drag.cur.y).ok; tiles = this.dragTiles().map((p) => ({ ...p, ok })); this.preview = { tiles }; this.hooks.cost && this.hooks.cost(def.cost, 1, def.name); return; }
    const water = (p) => w.terrain[w.idx(p.x, p.y)] === TERRAIN.WATER, bridge = (p) => water(p) && w.kind[w.idx(p.x, p.y)] === T.ROAD;
    tiles = this.dragTiles().map((p) => ({ ...p, ok: water(p)
      ? (this.tool === 'road' && !bridge(p)) || (bridge(p) && ['wire', 'cable', 'pipe', 'bulldoze'].includes(this.tool))   // roads over water become bridges
      : (this.tool !== 'wire' || [0, 1, 5].includes(w.kind[w.idx(p.x, p.y)])) && !(this.tool === 'avenue' && water(p)) }));
    this.preview = { tiles };
    const each = (t) => (this.tool === 'road' && water(t) ? COST.bridge : this.tool === 'avenue' && w.kind[w.idx(t.x, t.y)] === T.ROAD ? COST.avenue - COST.road : TOOL_COST[this.tool]);
    this.hooks.cost && this.hooks.cost(tiles.filter((t) => t.ok).reduce((a, t) => a + each(t), 0), tiles.length);
  }
  // ---------- undo ----------
  snapshot(tiles) {
    const w = this.world, set = new Set();
    for (const p of tiles) {
      if (!w.inb(p.x, p.y)) continue;
      const i = w.idx(p.x, p.y); set.add(i);
      if (w.kind[i] === T.SVC) {                       // a building is restored as a whole, not tile by tile
        const def = BT[w.bt[i]], ax = p.x - (w.bo[i] & 3), ay = p.y - (w.bo[i] >> 2);
        for (let dy = 0; dy < def.d; dy++) for (let dx = 0; dx < def.w; dx++) set.add(w.idx(ax + dx, ay + dy));
      }
    }
    return [...set].map((i) => ({ i, kind: w.kind[i], level: w.level[i], variant: w.variant[i], tree: w.tree[i], bt: w.bt[i], bo: w.bo[i], wire: w.wire[i], pipe: w.pipe[i] }));
  }
  record(snap, spent, label) {
    this.history.push({ snap, spent, label, t: performance.now() });
    if (this.history.length > 40) this.history.shift();
  }
  pruneHistory() { const now = performance.now(); while (this.history.length && now - this.history[0].t > UNDO_MS) this.history.shift(); }
  undo() {
    this.pruneHistory();
    const h = this.history.pop();
    if (!h) { this.hooks.toast && this.hooks.toast('Nothing to undo'); return false; }
    const w = this.world, s = this.sim;
    for (const t of h.snap) {
      w.kind[t.i] = t.kind; w.level[t.i] = t.level; w.variant[t.i] = t.variant; w.tree[t.i] = t.tree; w.bt[t.i] = t.bt; w.bo[t.i] = t.bo; w.wire[t.i] = t.wire; w.pipe[t.i] = t.pipe;
      s.pending.delete(t.i); this.sites.delete(t.i); this.disasters.fires.delete(t.i); this.disasters.rubble.delete(t.i);
    }
    if (!s.sandbox) s.money += h.spent; s.needAn = true; s.roadsDirty = true; s.recount(); s.analyze(); this.dirtySave = true; this.audio.play('undo');
    this.hooks.toast && this.hooks.toast(`Undid ${h.label}${h.spent ? ' (+$' + h.spent.toLocaleString('en-US') + ')' : ''}`);
    return true;
  }

  commit() {
    const def = BY_KEY[this.tool];
    if (def) {
      const x = this.drag.cur.x, y = this.drag.cur.y, snap = this.snapshot(this.dragTiles());
      const r = this.sim.placeBuilding(this.tool, x, y);
      if (r.ok) { this.dirtySave = true; this.record(snap, r.cost || 0, def.name); this.audio.play('build'); } else { this.audio.play('error'); if (r.why) this.say(r.why); }
      this.hooks.cost && this.hooks.cost(0, 0); return;
    }
    const tiles = this.dragTiles(), snap = this.snapshot(tiles); let spent = 0, n = 0, why = '';
    for (const p of tiles) {
      const r = this.sim.place(this.tool, p.x, p.y);
      if (r.ok) { n++; spent += r.cost || 0; } else if (r.why) { why = r.why; if (/money|debt/.test(r.why)) break; }
    }
    if (n) { this.dirtySave = true; this.sim.analyze(); this.record(snap, spent, `${this.toolLabel()} \u00d7${n}`); this.audio.play(this.tool === 'bulldoze' ? 'bulldoze' : ['res', 'com', 'ind'].includes(this.tool) ? 'zone' : 'build'); }
    if (!n && why) { this.say(why); this.audio.play('error'); }
    else if (n && /money|debt/.test(why)) this.say(why);
    this.hooks.cost && this.hooks.cost(0, 0);
  }
  toolLabel() { return ({ avenue: 'avenue', road: 'road', res: 'homes zone', com: 'shops zone', ind: 'industry zone', park: 'park', bulldoze: 'demolition', wire: 'power line', cable: 'cable', pipe: 'pipe' })[this.tool] || this.tool; }

  // ---------- loop ----------
  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    const frame = this.frame = (now) => {
      if (!this.running || this.away) return;
      this._raf = requestAnimationFrame(frame);           // schedule first, so one bad frame can never stop the game
      // Frame pacing: only do the work when the next frame is due (see targetFps). Skipped callbacks cost nothing.
      const fps = this.targetFps(now), iv = 1000 / fps;
      if (!this.nextDraw || now - this.nextDraw > 250) this.nextDraw = now;
      if (now < this.nextDraw - 2) return;
      this.nextDraw += iv; this.fpsNow = fps;
      const raw = (now - this.last) / 1000, dt = Math.min(0.1, raw); this.last = now;
      this.watchFrames(Math.min(0.5, Math.max(0, raw - (iv - 1000 / 60) / 1000)));      // judge speed as if aiming for 60
      if (!document.hidden && raw < 1) this.trackFrame(raw * 1000, now);
      const st = this.renderer.ctx.stat, m0 = spriteBudget.made, u0 = st ? st.uploads : 0, p0 = st ? st.upPx : 0, r0 = st ? st.recycles : 0, s0 = st ? st.solo : 0, t0 = performance.now();
      let t1 = t0;
      try { this.update(dt); t1 = performance.now(); this.renderer.draw(now / 1000); } catch (e) { if (!this.drawErr) { this.drawErr = true; console.error(e); } }
      const t2 = performance.now();
      this.bench(t2 - t0, raw * 1000, now);
      if (raw * 1000 > iv + 34 && this.runT > 3 && !document.hidden && raw < 1) {          // a stutter: note what happened in this frame and the one before
        const prev = this.lastWork || {};
        this.hitches.push({ at: now, ms: Math.round(raw * 1000), upd: Math.round(prev.upd || 0), drw: Math.round(prev.drw || 0), made: prev.made || 0, up: prev.up || 0, upKB: prev.upKB || 0, rec: prev.rec || 0, solo: prev.solo || 0 });
        if (this.hitches.length > 40) this.hitches.shift();
      }
      this.lastWork = { upd: t1 - t0, drw: t2 - t1, made: spriteBudget.made - m0, up: st ? st.uploads - u0 : 0, upKB: st ? Math.round((st.upPx - p0) * 4 / 1024) : 0, rec: st ? st.recycles - r0 : 0, solo: st ? st.solo - s0 : 0 };
    };
    this._raf = requestAnimationFrame(frame);
  }
  // How often to draw. Auto draws 60 times a second while you touch, drag or zoom (and for a moment after),
  // 30 when the view is still, 20 when the game is paused, and 30 on the start screen. A city builder looks
  // almost the same at 30 and the phone does half the work, so it runs cooler and the battery lasts longer.
  // The light that comes next on Auto, and how many game seconds until it does (for making its pictures early).
  nextLight() {
    if (this.timeSetting !== 'auto') return null;
    const ph = (this.clock / 180) % 1, cuts = [[0.55, 1], [0.62, 2], [0.9, 1], [1, 0]];
    for (const [p, m] of cuts) if (ph < p) return { mode: m, in: (p - ph) * 180 };
    return null;
  }
  targetFps(now) {
    const set = this.fpsSetting;
    if (set === 60 || set === 30) return set;
    if (this.menu) return 30;
    const c = this.cam, key = c.x * 7 + c.y * 13 + c.zoom * 1000;
    if (key !== this.camSeen) { this.camSeen = key; this.lastInput = now; }
    if (this.pointers.size > 0 || now - (this.lastInput || 0) < 1500 || this.disasters.tornado || this.disasters.ufo) return 60;
    if (this.speed === 0) return now - (this.lastInput || 0) > 10000 ? 10 : 20;       // paused and nobody touching: save battery
    return 30;
  }
  // First launch: watch how long frames take for a couple of seconds on the start screen and pick Smooth straight away
  // on a slow phone, instead of starting on Pretty and lagging before Auto notices. Remembered on the phone.
  bench(work, gap, now) {
    if (this.benchDone) return;
    let saved = null; if (!this.benchS) try { saved = localStorage.getItem('skyline.bench'); } catch (e) { /* ignore */ }
    if (saved) { this.benchDone = true; if (saved === 'smooth' && this.quality === 'auto' && !this.fast) { this.fast = true; this.renderer.resize(); this.hooks.quality && this.hooks.quality(); } return; }
    if (document.hidden) return;
    const b = this.benchS || (this.benchS = { t0: now, n: 0, work: 0, gap: 0 });
    if (now - b.t0 < 1500) return;                                   // let the first pictures be made
    b.n++; b.work += work; b.gap += Math.min(250, gap);
    if (now - b.t0 < 4000) return;
    const slow = b.work / b.n > 20 || b.gap / b.n > 45;
    try { localStorage.setItem('skyline.bench', slow ? 'smooth' : 'pretty'); } catch (e) { /* ignore */ }
    this.benchDone = true;
    if (slow && this.quality === 'auto' && !this.fast) { this.fast = true; this.renderer.resize(); this.hooks.quality && this.hooks.quality(); }
  }
  setSeasons(v) { this.seasons = v; try { localStorage.setItem('skyline.seasons', v); } catch (e) { /* ignore */ } }
  answerRequest(n) { this.sim.answerRequest(n); this.dirtySave = true; }
  setFps(v) { this.fpsSetting = v; try { localStorage.setItem('skyline.fps', String(v)); } catch (e) { /* ignore */ } }
  background(away) {
    if (away === !!this.away) return;
    this.away = away;
    if (away) { this.save(); this.audio.sleep(); cancelAnimationFrame(this._raf); this.hooks.away && this.hooks.away(true); }
    else {
      this.audio.wake(); this.hooks.away && this.hooks.away(false);
      if (this.running && this.frame) { this.last = performance.now(); cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(this.frame); }
    }
  }
  stop() { this.running = false; cancelAnimationFrame(this._raf); window.removeEventListener('resize', this._resize); window.removeEventListener('pagehide', this._hide); window.removeEventListener('pageshow', this._show); window.removeEventListener('blur', this._hide); window.removeEventListener('focus', this._show); document.removeEventListener('pause', this._hide); document.removeEventListener('resume', this._show); }
  // which recorded track suits the hour: morning, daytime, golden, dusk, night
  musicTrack() {
    if (this.timeSetting !== 'auto') return ['daytime', 'dusk', 'night'][this.mode] || 'daytime';
    const ph = (this.clock / 180) % 1;
    return ph >= 0.9 || ph < 0.2 ? 'morning' : ph < 0.42 ? 'daytime' : ph < 0.55 ? 'golden' : ph < 0.65 ? 'dusk' : 'night';
  }
  get abs() { return (this.clock / 180) * 24 + 6; }          // absolute clock hours; a day lasts 180s at 1x
  get hour() { return this.abs % 24; }
  update(dt) {
    const sp = this.menu ? 0 : this.speed, live = this.menu ? 1 : sp;   // on the start screen life moves but the city doesn't
    if (this.menu) this.menuCamera(dt);
    this.pruneHistory();
    this.clock += dt * sp;
    if (this.sim.sandbox && this.sim.money < 5000000) this.sim.money = 9999999;   // sandbox: the budget never runs out
    const was = this.mode;
    if (this.timeSetting === 'auto') { const ph = (this.clock / 180) % 1; this.mode = ph < 0.55 ? 0 : ph < 0.62 ? 1 : ph < 0.9 ? 2 : 1; }
    else this.mode = this.timeSetting;
    if (this.mode !== was) this.lightAt = performance.now();        // new pictures are being made: don't judge the phone's speed for a while
    setSeason(this.seasons === 'off' ? 0 : SEASON_OF[this.sim.month]);
    if (this.ambient) this.ambient.snow = getSeason() === 2;
    this.sim.seasonsOn = this.seasons !== 'off';   // trees, grass and parks follow the calendar (cached per season)
    if (sp > 0) {
      this.acc += dt * sp;
      while (this.acc >= 0.8) { this.acc -= 0.8; this.sim.tick(); this.dirtySave = true; }
    }
    this.sim.stepAnalyze();                                                // batched recalculation, one stage per frame
    const s = this.sim;
    while (s.events.length) {
      const ev = s.events.shift();
      if (ev.type === 'month') this.hooks.month && this.hooks.month(ev);
      else if (ev.type === 'goal') { this.audio.play('goal'); this.hooks.goal && this.hooks.goal(ev); }
      else if (ev.type === 'unlock') { this.audio.play('unlock'); this.hooks.unlock && this.hooks.unlock(ev); }
      else if (ev.type === 'news') this.hooks.news && this.hooks.news(ev);
      else if (ev.type === 'request') { this.audio.play(ev.fresh ? 'goal' : 'build'); this.hooks.request && this.hooks.request(ev); }
      else if (ev.type === 'cut') { this.audio.play('warn'); this.hooks.cut && this.hooks.cut(ev); }
      else if (ev.type === 'tut') this.audio.play('step');
      else if (ev.type === 'vote') { this.audio.play(ev.won ? 'goal' : 'warn'); this.say(ev.won ? `Re-elected with ${ev.approval}% approval` : `Lost the election (${ev.approval}% approval). Taxes capped at 9% for a year`); }
      else if (ev.type === 'moveOut') this.movers.leave(ev.i, ev.n);
      else if (ev.type === 'moveIn') this.movers.arrive(ev.i, ev.n);
      else if (ev.type === 'built' && !this.sites.has(ev.i)) { const info = siteInfo(ev); this.sites.set(ev.i, { i: ev.i, kind: ev.kind, from: ev.from, to: ev.to, pv: ev.pv || 0, t: 0, ...info }); }
    }
    for (const [i, site] of this.sites) { site.t += dt * sp; if (site.t >= site.dur) { this.sites.delete(i); s.finish(i); } }
    this.siteCheck = (this.siteCheck || 0) + dt;
    if (this.siteCheck > 1) { this.siteCheck = 0; for (const i of this.sites.keys()) { const k = this.world.kind[i]; if (k === T.EMPTY || k === T.ROAD) { this.sites.delete(i); s.finish(i); } } for (const i of [...s.pending.keys()]) if (!this.sites.has(i)) s.finish(i); }
    // life scales with the city; people follow real routines (home, work, shops, parks)
    const night = this.mode === 2 ? 0.45 : this.mode === 1 ? 0.8 : 1;
    const carT = Math.min(60, Math.floor((s.pop / 14 + (s.cJobs + s.iJobs) / 30) * night * (1 - 0.45 * Math.max(s.net.transit, (s.net.metro || 0) * 1.2))), Math.floor(s.roads / 2));   // good bus coverage takes cars off the road
    const sig = this.clock, veh = this.traffic.cars.concat(this.agents.drivers, this.transit.buses, this.movers.vans);
    followPass(veh);                                                       // vehicles queue behind each other
    this.traffic.update(dt * live, Math.floor(carT * 0.3), sig);
    this.agents.update(dt * live, dt, this.abs, Math.min(240, Math.floor(s.pop / 4)), sig);
    this.transit.update(dt * live, dt, sig);
    this.movers.update(dt * live, sig);
    this.garbage.update(dt * live, Math.min(10, s.facilities.length * 2), sig);
    this.ambient.update(live > 0 ? dt : 0, this.mode);
    if (!this.life) this.life = new Life(this);
    this.life.update(live > 0 ? dt : 0);                                  // people at parks, beaches, piers and on the dirt tracks
    this.fleet.update(live > 0 ? dt : 0, s.pop);
    this.ships.update(live > 0 ? dt : 0, s);
    // congestion map: smoothed vehicle count per road tile
    this.sim.flowM.step(this.sim, this.fast ? 1.5 : 2.5);            // trips to roads, a little at a time (flow.js)
    this.disasters.update(dt * sp);
    this.tutT += dt;
    if (this.tutT > 0.5) { this.tutT = 0; s.checkTutorial(); }
    const alertN = this.disasters.fires.size + (this.disasters.tornado ? 1 : 0) + (this.disasters.ufo ? 1 : 0);
    if (alertN && !this.lastAlert) this.audio.play('alarm');
    this.lastAlert = alertN;
    this.sceneT += dt;
    if (this.sceneT > 0.5) { this.sceneT = 0; this.audio.setScene({ pop: s.pop, zoom: this.cam.zoom, rain: this.ambient.snow ? 0 : this.ambient.weather.k, night: this.mode === 2, track: this.musicTrack(), paused: sp === 0 }); }
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; if (this.dirtySave && !this.menu) this.save(); }
  }
}
