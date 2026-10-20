import { World, N, T } from './world.js';
import { Sim, COST } from './sim.js';
import { BY_KEY, BT } from './buildings.js';
import { ORD } from './rules.js';
import { Renderer } from './renderer.js';
import { Traffic, Trucks } from './cars.js';
import { Agents } from './agents.js';
import { siteInfo } from './construction.js';
import { Disasters } from './disasters.js';
import { Transit } from './transit.js';
import { Ambient } from './ambient.js';
import { followPass } from './traffic.js';
import { clamp, mulberry32 } from './util.js';

const SAVE_KEY = 'skyline.save.v1';
const UNDO_MS = 20000;                 // a build can only be undone shortly after you make it
const TOOL_COST = { pipe: COST.pipe, wire: COST.wire, cable: COST.cable, road: COST.road, res: COST.zone, com: COST.zone, ind: COST.zone, park: COST.park, bulldoze: COST.bulldoze };
for (const b of Object.values(BT)) TOOL_COST[b.key] = b.cost;

export class Game {
  constructor(canvas, hooks = {}) {
    this.cv = canvas; this.hooks = hooks;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.tool = null; this.speed = 1; this.timeSetting = 'auto'; this.mode = 0; this.clock = 20;
    this.history = []; this.overlay = null; this.preview = null; this.drag = null; this.pointers = new Map(); this.pinch = null; this.pan = null;
    this.acc = 0; this.last = 0; this.running = false; this.dirtySave = false; this.saveTimer = 0;
    this.renderer = new Renderer(canvas, this);
    this.load() || this.newCity(Math.floor(Math.random() * 100000), true);
    this.bind();
  }
  initWorldLife(seed) {
    this.transit = new Transit(this.world, this.sim, this.agents, mulberry32(seed + 7));
    this.agents.transit = this.transit;
    this.ambient = new Ambient(this.world, mulberry32(seed + 8));
    this.density = new Float32Array(N * N);
  }
  get cars() { return this.traffic.cars.concat(this.agents.drivers, this.transit.buses); }
  get people() { return this.agents.walkers; }
  get trucks() { return this.garbage.trucks.concat(this.disasters.responders); }
  newCity(seed, silent) {
    this.world = new World(seed);
    this.sim = new Sim(this.world); this.sim.defer = true;
    this.traffic = new Traffic(this.world, mulberry32(seed + 3));
    this.sites = new Map(); this.history = [];
    this.agents = new Agents(this.world, mulberry32(seed + 4), (i) => this.sites.has(i));
    this.garbage = new Trucks(this.world, mulberry32(seed + 5), () => this.sim.facilities);
    this.disasters = new Disasters(this); this.initWorldLife(seed);
    this.fitCamera();
    this.dirtySave = true;
    if (!silent) this.hooks.toast && this.hooks.toast('New city founded');
  }
  fitCamera() {
    const r = this.renderer;
    const z = clamp(Math.min(r.W / 700, r.H / 430), 0.75, 1.3);
    this.cam.zoom = z;
    this.cam.x = r.W / 2; this.cam.y = r.H / 2 - (N * 16 * z) + 10 * z;
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, world: this.world.toJSON(), sim: this.sim.state(), cam: this.cam, clock: this.clock }));
      this.dirtySave = false; return true;
    } catch (e) { return false; }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
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
  setTool(t) { this.tool = t; this.preview = null; this.drag = null; }
  setSpeed(s) { this.speed = s; }
  setTime(s) { this.timeSetting = s; }
  setOverlay(o) { this.overlay = o; }
  setWeather(v) { this.ambient.setting = v; }
  setOrd(k, on) { this.sim.setOrd(k, on); this.dirtySave = true; }
  setDisasters(v) { this.sim.disasters = v; this.dirtySave = true; }
  trigger(k) { this.disasters.trigger(k); }
  stats() {
    const s = this.sim;
    return { money: Math.floor(s.money), pop: s.pop, date: s.dateLabel(), rd: s.rd, cd: s.cd, id: s.id, happy: s.happiness, tax: { ...s.tax }, income: s.lastIncome, expense: s.lastExpense, bld: s.bld, roads: s.roads, parks: s.parks, jobs: s.cJobs + s.iJobs, speed: this.speed, mode: this.mode, time: `${String(Math.floor(this.hour)).padStart(2, '0')}:${String(Math.floor((this.hour % 1) * 60)).padStart(2, '0')}`, citizens: this.agents.stats.total, employed: this.agents.stats.employed, tSup: s.net.tSup, tDem: s.net.tDem, wasteUn: s.net.wasteUn, pSup: s.net.pSup, pDem: s.net.pDem, wSup: s.net.wSup, wDem: s.net.wDem, upkeep: Math.round(s.net.upkeep), crime: Math.round(s.net.crimeAvg), poll: Math.round(s.net.pollAvg), cov: { police: s.net.police, fire: s.net.fire, health: s.net.health, edu: s.net.edu, fun: s.net.fun }, overlay: this.overlay,
      canUndo: this.history.length, undoLabel: this.history.length ? this.history[this.history.length - 1].label : '', undoLeft: this.history.length ? Math.max(1, Math.ceil((UNDO_MS - (performance.now() - this.history[this.history.length - 1].t)) / 1000)) : 0,
      weather: this.ambient.setting, rain: this.ambient.weather.k, buses: this.transit.buses.length, riders: this.agents.stats.riding, heavyRoads: (() => { let n = 0; for (let i = 0; i < this.density.length; i++) if (this.density[i] > 1.3) n++; return n; })(),
      grant: s.grant || Math.round(Math.max(0, 300 * (1 - s.pop / 1200))), streak: s.streak, ordCost: s.ordCost(), disastersLevel: s.disasters,
      ords: Object.entries(ORD).map(([key, o]) => ({ key, ...o, on: !!s.ord[key] })), goals: s.goalStatus(),
      alerts: [this.disasters.fires.size ? `Fire x${this.disasters.fires.size}` : '', this.disasters.tornado ? 'Tornado' : '', this.disasters.ufo ? 'UFO' : ''].filter(Boolean) };
  }
  setTax(k, v) { this.sim.tax[k] = clamp(v, 0, 20); this.sim.recount(); this.dirtySave = true; }

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
    const minX = r.W - N * 32 * z * 0.4, maxX = N * 32 * z * 0.4;
    c.x = clamp(c.x, minX, maxX);
    c.y = clamp(c.y, r.H - N * 32 * z * 0.95, N * 8 * z + 120);
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
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }
  pos(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  down(e) {
    this.cv.setPointerCapture && this.cv.setPointerCapture(e.pointerId);
    const p = this.pos(e); this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) { this.drag = null; this.preview = null; this.pan = null; this.startPinch(); return; }
    if (this.pointers.size > 2) return;
    if (this.tool && e.button === 0) { const t = this.toTile(p.x, p.y); this.drag = { start: t, cur: t }; this.updatePreview(); }
    else this.pan = { x: p.x, y: p.y };
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pos(e); const prev = this.pointers.get(e.pointerId); this.pointers.set(e.pointerId, p);
    if (this.pinch && this.pointers.size === 2) { this.doPinch(); return; }
    if (this.drag) { this.drag.cur = this.toTile(p.x, p.y); this.updatePreview(); }
    else if (this.pan) { this.cam.x += p.x - prev.x; this.cam.y += p.y - prev.y; this.clampCam(); }
  }
  up(e, cancel) {
    const had = this.pointers.has(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!had) return;
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.pan = null; return; }
    if (this.drag && !cancel) this.commit();
    this.drag = null; this.preview = null; this.pan = null;
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
    if (this.tool === 'road' || this.tool === 'wire' || this.tool === 'cable' || this.tool === 'pipe') {
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
    tiles = this.dragTiles().map((p) => ({ ...p, ok: w.buildable(p.x, p.y) && (this.tool !== 'wire' || [0, 1, 5].includes(w.kind[w.idx(p.x, p.y)])) }));
    this.preview = { tiles };
    this.hooks.cost && this.hooks.cost(tiles.filter((t) => t.ok).length * TOOL_COST[this.tool], tiles.length);
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
    s.money += h.spent; s.needAn = true; s.recount(); s.analyze(); this.dirtySave = true;
    this.hooks.toast && this.hooks.toast(`Undid ${h.label}${h.spent ? ' (+$' + h.spent.toLocaleString('en-US') + ')' : ''}`);
    return true;
  }

  commit() {
    const def = BY_KEY[this.tool];
    if (def) {
      const x = this.drag.cur.x, y = this.drag.cur.y, snap = this.snapshot(this.dragTiles());
      const r = this.sim.placeBuilding(this.tool, x, y);
      if (r.ok) { this.dirtySave = true; this.record(snap, r.cost || 0, def.name); } else if (r.why) this.hooks.toast && this.hooks.toast(r.why);
      this.hooks.cost && this.hooks.cost(0, 0); return;
    }
    const tiles = this.dragTiles(), snap = this.snapshot(tiles); let spent = 0, n = 0, why = '';
    for (const p of tiles) {
      const r = this.sim.place(this.tool, p.x, p.y);
      if (r.ok) { n++; spent += r.cost || 0; } else if (r.why) { why = r.why; if (r.why === 'Not enough money') break; }
    }
    if (n) { this.dirtySave = true; this.sim.analyze(); this.record(snap, spent, `${this.toolLabel()} \u00d7${n}`); }
    if (!n && why) this.hooks.toast && this.hooks.toast(why);
    this.hooks.cost && this.hooks.cost(0, 0);
  }
  toolLabel() { return ({ road: 'road', res: 'homes zone', com: 'shops zone', ind: 'industry zone', park: 'park', bulldoze: 'demolition', wire: 'power line', cable: 'cable', pipe: 'pipe' })[this.tool] || this.tool; }

  // ---------- loop ----------
  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      this.update(dt); this.renderer.draw(now / 1000);
      this._raf = requestAnimationFrame(frame);
    };
    this._raf = requestAnimationFrame(frame);
  }
  stop() { this.running = false; cancelAnimationFrame(this._raf); window.removeEventListener('resize', this._resize); }
  get abs() { return (this.clock / 180) * 24 + 6; }          // absolute clock hours; a day lasts 180s at 1x
  get hour() { return this.abs % 24; }
  update(dt) {
    const sp = this.speed;
    this.pruneHistory();
    this.clock += dt * sp;
    if (this.timeSetting === 'auto') { const ph = (this.clock / 180) % 1; this.mode = ph < 0.55 ? 0 : ph < 0.62 ? 1 : ph < 0.9 ? 2 : 1; }
    else this.mode = this.timeSetting;
    if (sp > 0) {
      this.acc += dt * sp;
      while (this.acc >= 0.8) { this.acc -= 0.8; this.sim.tick(); this.dirtySave = true; }
    }
    const s = this.sim;
    while (s.events.length) {
      const ev = s.events.shift();
      if (ev.type === 'month') this.hooks.month && this.hooks.month(ev);
      else if (ev.type === 'goal') this.hooks.goal && this.hooks.goal(ev);
      else if (ev.type === 'built' && !this.sites.has(ev.i)) { const info = siteInfo(ev); this.sites.set(ev.i, { i: ev.i, kind: ev.kind, from: ev.from, to: ev.to, pv: ev.pv || 0, t: 0, ...info }); }
    }
    for (const [i, site] of this.sites) { site.t += dt * sp; if (site.t >= site.dur) { this.sites.delete(i); s.finish(i); } }
    this.siteCheck = (this.siteCheck || 0) + dt;
    if (this.siteCheck > 1) { this.siteCheck = 0; for (const i of this.sites.keys()) { const k = this.world.kind[i]; if (k === T.EMPTY || k === T.ROAD) { this.sites.delete(i); s.finish(i); } } for (const i of [...s.pending.keys()]) if (!this.sites.has(i)) s.finish(i); }
    // life scales with the city; people follow real routines (home, work, shops, parks)
    const night = this.mode === 2 ? 0.45 : this.mode === 1 ? 0.8 : 1;
    const carT = Math.min(60, Math.floor((s.pop / 14 + (s.cJobs + s.iJobs) / 30) * night), Math.floor(s.roads / 2));
    const sig = this.clock, veh = this.traffic.cars.concat(this.agents.drivers, this.transit.buses);
    followPass(veh);                                                       // vehicles queue behind each other
    this.traffic.update(dt * sp, Math.floor(carT * 0.3), sig);
    this.agents.update(dt * sp, dt, this.abs, Math.min(240, Math.floor(s.pop / 4)), sig);
    this.transit.update(dt * sp, dt, sig);
    this.garbage.update(dt * sp, Math.min(10, s.facilities.length * 2), sig);
    this.ambient.update(sp > 0 ? dt : 0, this.mode);
    // congestion map: smoothed vehicle count per road tile
    { const dn = this.density, a = 1 - Math.exp(-dt * 0.6); for (let i = 0; i < dn.length; i++) if (dn[i] > 0.001) dn[i] -= dn[i] * a;
      for (const v of veh) { const i = Math.max(0, Math.min(N - 1, Math.floor(v.py))) * N + Math.max(0, Math.min(N - 1, Math.floor(v.px))); dn[i] += a; } }
    this.disasters.update(dt * sp);
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; if (this.dirtySave) this.save(); }
  }
}
