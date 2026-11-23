// Far zoom (0.8.1): the whole city (ground, roads, trees, parks and buildings) is baked into one picture, so a big city
// zoomed out costs one image draw per frame instead of thousands. Water stays live underneath (the picture is
// transparent there) and moving things are drawn on top. Only the part around a changed tile is redrawn; a change of
// light (day, dusk, night) or season redraws everything a few diagonals per frame, with the normal drawing shown
// meanwhile. Night windows are simply lit when powered (the one-by-one lighting only shows close up).
import { N, T } from './world.js';
import { BT } from './buildings.js';
import { buildingSprite, parkSprite, treeSprite, serviceSprite, mip, getSeason, spriteBudget } from './sprites.js';
import { touched } from './gl2d.js';

export const FAR = 0.42;              // device pixels per world unit at or below which the cache is used
const S = 0.4;                         // cache pixels per world unit
const TOPH = 380;                      // room above the map's top corner for the tallest buildings (world units)
const RX = 110, UP = 380, DN = 40;     // how far a tile's pictures can reach left/right, up and down (world units)

export class CityCache {
  constructor(r) { this.r = r; this.c = null; this.sig = new Int32Array(N * N).fill(-2); this.key = ''; this.job = null; this.ok = false; this.dirty = []; }
  sigOf(g, i) {
    const w = g.world, k = w.kind[i];
    let s = k + (w.level[i] << 3) + ((w.variant[i] & 63) << 6) + ((w.tree[i] & 15) << 12) + ((w.bt[i] & 255) << 16) + ((w.bo[i] & 15) << 24);
    if (g.sim.pw[i]) s += 1 << 28; if (g.sim.aband[i]) s ^= 0x2468; if (g.sites.has(i)) s += 1 << 29; if (w.terrain[i]) s ^= w.terrain[i] << 4;
    return s | 0;
  }
  // tile (x, y) top corner in cache units (before scaling)
  X(x, y) { return (x - y) * 32 + N * 32; }
  Y(x, y) { return (x + y) * 16 + TOPH; }
  // Returns true when the picture is up to date enough to draw.
  update(g, mode) {
    const w = g.world, key = `${mode},${getSeason()},${w.seed},${w.map}`;
    if (!this.c) { this.c = document.createElement('canvas'); this.c.width = Math.ceil(N * 64 * S); this.c.height = Math.ceil((N * 32 + TOPH + DN) * S); this.x = this.c.getContext('2d'); this.c._solo = true; }
    if (key !== this.key || this.forW !== w) { this.key = key; this.forW = w; this.ok = false; this.job = { s: 0, mode }; this.x.setTransform(1, 0, 0, 1, 0, 0); this.x.clearRect(0, 0, this.c.width, this.c.height); this.sig.fill(-2); this.dirty.length = 0; }
    const t0 = performance.now();
    if (this.job) {                                    // full build: a few diagonals at a time, painter order
      const job = this.job;
      spriteBudget.left = Math.max(spriteBudget.left, 6);       // the pictures this needs are mostly made already; allow a few more
      this.x.setTransform(S, 0, 0, S, 0, 0);
      while (job.s < 2 * N - 1 && performance.now() - t0 < 8) {
        const s = job.s++;
        for (let x = Math.max(0, s - N + 1); x <= Math.min(s, N - 1); x++) { const y = s - x, i = y * N + x; this.tile(g, x, y, mode); }
      }
      if (job.s >= 2 * N - 1) { this.job = null; this.ok = true; for (let i = 0; i < N * N; i++) if (this.sig[i] !== -1) this.sig[i] = this.sigOf(g, i); touched(this.c); }   // tiles still missing a picture (-1) get redrawn later
      return false;
    }
    // what changed since the last frame
    for (let i = 0; i < N * N; i++) { const s = this.sigOf(g, i); if (s !== this.sig[i]) { this.sig[i] = s; this.dirty.push(i); } }
    let n = 0;
    while (this.dirty.length && n < 6 && performance.now() - t0 < 4) { this.region(g, this.dirty.shift(), mode); n++; }
    return this.ok;
  }
  // redraw everything that can overlap the pictures of tile i
  region(g, i, mode) {
    const w = g.world; let x = i % N, y = (i / N) | 0;
    if (w.kind[i] === T.SVC) { const def = BT[w.bt[i]]; if (def) { x -= w.bo[i] & 3; y -= w.bo[i] >> 2; const X1 = this.X(x, y + def.d) - RX * 2, X2 = this.X(x + def.w, y) + RX * 2; return this.redraw(g, X1, this.Y(x, y) - UP, X2, this.Y(x + def.w, y + def.d) + DN, mode); } }
    const X = this.X(x, y), Y = this.Y(x, y);
    this.redraw(g, X - RX, Y - UP, X + RX, Y + 32 + DN, mode);
  }
  redraw(g, x0, y0, x1, y1, mode) {
    const c = this.x;
    c.save(); c.setTransform(S, 0, 0, S, 0, 0);
    c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); c.clearRect(x0, y0, x1 - x0, y1 - y0);
    this.missing = false;
    for (let s = 0; s < 2 * N - 1; s++) {
      const Ys = s * 16 + TOPH; if (Ys + 32 + DN < y0 || Ys - UP > y1) continue;
      for (let x = Math.max(0, s - N + 1); x <= Math.min(s, N - 1); x++) {
        const y = s - x, X = this.X(x, y); if (X + RX * 2.6 < x0 || X - RX * 2.6 > x1) continue;
        this.tile(g, x, y, mode);
      }
    }
    c.restore();
    touched(this.c, Math.floor(x0 * S), Math.floor(y0 * S), Math.ceil(x1 * S), Math.ceil(y1 * S));
  }
  // one tile: its ground, then whatever stands on it
  tile(g, x, y, mode) {
    const w = g.world, c = this.x, i = y * N + x, k = w.kind[i], X = this.X(x, y), Y = this.Y(x, y), r = this.r;
    r.groundTile(c, w, x, y, X, Y, 1, mode, 2);
    if (g.sites.has(i)) return;                                  // building sites are drawn live
    const img = (sp) => { if (!sp) { this.sig[i] = -1; return; } c.drawImage(sp.c, X - sp.ox, Y - sp.oy, sp.c.width / sp.S, sp.c.height / sp.S); };
    if (k === T.EMPTY && w.tree[i]) img(mip(treeSprite(w.tree[i], mode), 2));
    else if (k === T.PARK) img(mip(parkSprite(w.variant[i] % 4, mode), 2));
    else if ((k === T.RES || k === T.COM || k === T.IND) && w.level[i]) img(mip(buildingSprite(k, w.level[i], w.variant[i] & 63, mode, g.sim.pw[i] === 1 && !g.sim.aband[i], w.shore[i]), 2));
    else if (k === T.SVC) {
      const def = BT[w.bt[i]]; if (!def) return;
      const dx = w.bo[i] & 3, dy = w.bo[i] >> 2; if (dx !== def.w - 1 || dy !== def.d - 1) return;     // whole picture with its front tile
      const ax = x - dx, ay = y - dy, a = ay * N + ax; if (g.sites.has(a)) return;
      const sp = mip(serviceSprite(w.bt[i], mode, def.power ? true : g.sim.pw[a] === 1, def.reach ? w.variant[a] : 0), 2);
      if (!sp) { this.sig[i] = -1; return; }
      c.drawImage(sp.c, this.X(ax, ay) - sp.ox, this.Y(ax, ay) - sp.oy, sp.c.width / sp.S, sp.c.height / sp.S);
    }
  }
  draw(ctx, z, cx, cy) {
    const d = this.r.dpr;
    ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.c, cx - N * 32 * z, cy - TOPH * z, (this.c.width / S) * z, (this.c.height / S) * z);
    ctx.restore();
  }
}
