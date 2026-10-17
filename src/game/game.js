import { World, N, T } from './world.js';
import { Sim, COST } from './sim.js';
import { BY_KEY, BT } from './buildings.js';
import { Renderer } from './renderer.js';
import { Traffic, Walkers, Trucks } from './cars.js';
import { clamp, mulberry32 } from './util.js';

const SAVE_KEY = 'skyline.save.v1';
const TOOL_COST = { wire: COST.wire, cable: COST.cable, road: COST.road, res: COST.zone, com: COST.zone, ind: COST.zone, park: COST.park, bulldoze: COST.bulldoze };
for (const b of Object.values(BT)) TOOL_COST[b.key] = b.cost;

export class Game {
  constructor(canvas, hooks = {}) {
    this.cv = canvas; this.hooks = hooks;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.tool = null; this.speed = 1; this.timeSetting = 'auto'; this.mode = 0; this.clock = 20;
    this.overlay = null; this.preview = null; this.drag = null; this.pointers = new Map(); this.pinch = null; this.pan = null;
    this.acc = 0; this.last = 0; this.running = false; this.dirtySave = false; this.saveTimer = 0;
    this.renderer = new Renderer(canvas, this);
    this.load() || this.newCity(Math.floor(Math.random() * 100000), true);
    this.bind();
  }
  get cars() { return this.traffic.cars; }
  get people() { return this.walkers.people; }
  get trucks() { return this.garbage.trucks; }
  newCity(seed, silent) {
    this.world = new World(seed);
    this.sim = new Sim(this.world);
    this.traffic = new Traffic(this.world, mulberry32(seed + 3));
    this.walkers = new Walkers(this.world, mulberry32(seed + 4));
    this.garbage = new Trucks(this.world, mulberry32(seed + 5), () => this.sim.facilities);
    this.fitCamera();
    this.dirtySave = true;
    if (!silent) this.hooks.toast && this.hooks.toast('New city founded');
  }
  fitCamera() {
    const r = this.renderer;
    const z = clamp(r.W / 700, 0.9, 1.3);
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
      this.sim = new Sim(this.world, o.sim);
      this.traffic = new Traffic(this.world, mulberry32(this.world.seed + 3));
      this.walkers = new Walkers(this.world, mulberry32(this.world.seed + 4));
      this.garbage = new Trucks(this.world, mulberry32(this.world.seed + 5), () => this.sim.facilities);
      if (o.cam) this.cam = o.cam; else this.fitCamera();
      this.clock = o.clock || 20;
      return true;
    } catch (e) { return false; }
  }
  setTool(t) { this.tool = t; this.preview = null; this.drag = null; }
  setSpeed(s) { this.speed = s; }
  setTime(s) { this.timeSetting = s; }
  setOverlay(o) { this.overlay = o; }
  stats() {
    const s = this.sim;
    return { money: Math.floor(s.money), pop: s.pop, date: s.dateLabel(), rd: s.rd, cd: s.cd, id: s.id, happy: s.happiness, tax: { ...s.tax }, income: s.lastIncome, expense: s.lastExpense, bld: s.bld, roads: s.roads, parks: s.parks, jobs: s.cJobs + s.iJobs, speed: this.speed, mode: this.mode, tSup: s.net.tSup, tDem: s.net.tDem, wasteUn: s.net.wasteUn, pSup: s.net.pSup, pDem: s.net.pDem, wSup: s.net.wSup, wDem: s.net.wDem, upkeep: Math.round(s.net.upkeep), crime: Math.round(s.net.crimeAvg), poll: Math.round(s.net.pollAvg), cov: { police: s.net.police, fire: s.net.fire, health: s.net.health, edu: s.net.edu, fun: s.net.fun }, overlay: this.overlay };
  }
  setTax(k, v) { this.sim.tax[k] = clamp(v, 0, 20); this.sim.recount(); this.dirtySave = true; }

  // ---------- coordinates ----------
  toTile(px, py) {
    const z = this.cam.zoom, u = (px - this.cam.x) / z, v = (py - this.cam.y) / z;
    return { x: Math.floor((u / 32 + v / 16) / 2), y: Math.floor((v / 16 - u / 32) / 2) };
  }
  zoomAt(px, py, f) {
    const c = this.cam, nz = clamp(c.zoom * f, 0.35, 2.6), k = nz / c.zoom;
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
    if (this.tool === 'road' || this.tool === 'wire' || this.tool === 'cable') {
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
  commit() {
    const def = BY_KEY[this.tool];
    if (def) {
      const r = this.sim.placeBuilding(this.tool, this.drag.cur.x, this.drag.cur.y);
      if (r.ok) this.dirtySave = true; else if (r.why) this.hooks.toast && this.hooks.toast(r.why);
      this.hooks.cost && this.hooks.cost(0, 0); return;
    }
    const tiles = this.dragTiles(); let spent = 0, n = 0, why = '';
    for (const p of tiles) {
      const r = this.sim.place(this.tool, p.x, p.y);
      if (r.ok) { n++; spent += r.cost || 0; } else if (r.why) { why = r.why; if (r.why === 'Not enough money') break; }
    }
    if (n) { this.dirtySave = true; this.sim.analyze(); }
    if (!n && why) this.hooks.toast && this.hooks.toast(why);
    this.hooks.cost && this.hooks.cost(0, 0);
  }

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
  update(dt) {
    this.clock += dt;
    if (this.timeSetting === 'auto') { const ph = (this.clock / 180) % 1; this.mode = ph < 0.55 ? 0 : ph < 0.62 ? 1 : ph < 0.9 ? 2 : 1; }
    else this.mode = this.timeSetting;
    if (this.speed > 0) {
      this.acc += dt * this.speed;
      while (this.acc >= 0.8) { this.acc -= 0.8; this.sim.tick(); this.dirtySave = true; }
    }
    const s = this.sim, run = this.speed > 0 ? 1 : 0;
    // life scales with the city: nothing on empty roads, busier as people and jobs arrive
    const night = this.mode === 2 ? 0.45 : this.mode === 1 ? 0.8 : 1;
    const carT = Math.min(60, Math.floor((s.pop / 14 + (s.cJobs + s.iJobs) / 30) * night), Math.floor(s.roads / 2));
    const pedT = Math.min(90, Math.floor((s.pop / 7) * (this.mode === 2 ? 0.25 : this.mode === 1 ? 0.7 : 1)), s.roads * 2);
    this.traffic.update(dt * run, carT);
    this.walkers.update(dt * run, pedT);
    this.garbage.update(dt * run, Math.min(10, this.sim.facilities.length * 2));
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; if (this.dirtySave) this.save(); }
    while (this.sim.events.length) { const ev = this.sim.events.shift(); this.hooks.month && this.hooks.month(ev); }
  }
}
