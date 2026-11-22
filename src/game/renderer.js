import { hash } from './util.js';
import { N, T, TERRAIN } from './world.js';
import { SVC_FLAGS, getSeason, spriteBudget, buildingSprite, parkSprite, zoneSprite, terrainSprite, treeSprite, roadSprite, serviceSprite, mip, bridgeUnder, bridgeTop } from './sprites.js';
import { tint } from './util.js';
import { BT } from './buildings.js';
import { REAL_H, SVC_H } from './construction.js';
import { drawConstruction } from './construction.js';
import { drawSmoke, SMOKE } from './smoke.js';
import { WF_SMOKE } from './waterfront.js';
import { isSignal, light } from './traffic.js';
import { createContext, touched } from './gl2d.js';
// Which vertical strips of a w x d building picture belong to which of its tiles: each half-tile column goes to the
// frontmost footprint tile it crosses; the picture's side margins go to the outermost columns. Cached per size.
const SLICES = new Map();
function sliceOf(fw, fd) {
  const key = fw * 8 + fd; if (SLICES.has(key)) return SLICES.get(key);
  const own = [];
  for (let k = -fd; k <= fw - 1; k++) { let best = null; for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) if ((k === i - j - 1 || k === i - j) && (!best || i + j > best[0] + best[1])) best = [i, j]; own.push([k, best[1] * fw + best[0]]); }
  const out = Array.from({ length: fw * fd }, () => []);
  for (let n = 0; n < own.length; n++) {
    const [k, t] = own[n], k0 = n === 0 ? -1e4 : k, k1 = n === own.length - 1 ? 1e4 : k + 1, r = out[t], prev = r[r.length - 1];
    if (prev && prev[1] === k0) prev[1] = k1; else r.push([k0, k1]);
  }
  SLICES.set(key, out); return out;
}
const D4R = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// harbor ship colours: hulls, containers, and the loads barges carry (sand, coal, gravel, clay, rubble)
const HULL = [[38, 52, 78], [128, 44, 36], [34, 78, 62], [42, 42, 48], [26, 92, 120]];
const BOX = [[196, 70, 52], [52, 110, 176], [222, 168, 52], [64, 148, 96], [200, 200, 205], [150, 74, 140]];
const CARGO = [[214, 190, 140], [70, 66, 64], [168, 150, 128], [190, 120, 80], [120, 130, 110]];

const BG = [['#2a78a8', '#6fb4d6'], ['#3a4f86', '#c98a78'], ['#050a1f', '#14204a']];
const CAR_COLS = ['#e0b43a', '#4a7fc7', '#c9372c', '#7a5bd0', '#4aa36a', '#f2f2f2', '#e67e22', '#2c3e50'];

const BADGE_H = [0, 34, 60, 100, 190];
// Water colors from the shoreline (0 tiles from land) out to deep water.
const WATER_RAMP = [[0, '#93dccb'], [0.7, '#6cc9cc'], [1.6, '#4fb2cf'], [3, '#3e98c8'], [5, '#3283bb'], [8, '#296fa8'], [12, '#235f95']];
const FOAM_A = [1, 0.85, 0.5];
// colour and strength of the glints on the water: white sun, orange sunset, faint blue moonlight
const SUN = [[1, 0.97, 0.88, 0.9], [1, 0.6, 0.28, 1], [0.7, 0.8, 1, 0.35]];
// the sky colour mirrored by far water, and how much of it
const SKY = [[0.82, 0.92, 1, 0.12], [1, 0.62, 0.4, 0.38], [0.1, 0.14, 0.3, 0.22]];
const GP = 24;            // ground cache: texels per tile edge (the cache is drawn in tile space and skewed into place)
const WQ = 8;             // water texture: texels per tile edge
const SQ = 32;            // water shimmer pattern: texels per tile edge

export class Renderer {
  constructor(canvas, game) {
    this.cv = canvas; this.ctx = createContext(canvas); this.game = game; this.engine = this.ctx.engine;
    this.dpr = 1; this.W = 0; this.H = 0;
    this.rain = null; this.glow = null; this.foam = []; this.shore = null; this.dist = null; this.shoreFor = null; this.wtex = []; this.shim = null; this.gc = null; this.gc2 = null;
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    // Pretty draws sharper than the screen's basic resolution: 1.5x on tablets, 1.25x on phones, where more is hard to see
    // but costs the GPU (and heat). Smooth draws at 1x.
    const small = Math.min(r.width, r.height) < 500;
    this.dpr = Math.min(this.game && this.game.fast ? 1 : small ? 1.25 : 1.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.W = Math.max(1, r.width | 0); this.H = Math.max(1, r.height | 0);
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
  }
  glowSprite() {
    if (this.glow) return this.glow;
    const c = document.createElement('canvas'); c.width = 96; c.height = 48;
    const x = c.getContext('2d'), g = x.createRadialGradient(48, 24, 0, 48, 24, 46);
    g.addColorStop(0, 'rgba(255,217,140,.55)'); g.addColorStop(1, 'rgba(255,217,140,0)');
    x.save(); x.scale(1, 0.5); x.translate(0, 24); x.fillStyle = g; x.fillRect(0, -48, 96, 96); x.restore();
    return (this.glow = c);
  }
  // A soft warm pool of light on the ground (lamps, lit buildings at night).
  poolSprite() {
    if (this.pool) return this.pool;
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 32, 0, 64, 32, 62);
    g.addColorStop(0, 'rgba(255,206,130,.62)'); g.addColorStop(0.45, 'rgba(255,180,100,.24)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    x.save(); x.translate(0, 16); x.scale(1, 0.5); x.fillStyle = g; x.fillRect(0, -32, 128, 128); x.restore();
    return (this.pool = c);
  }
  // A headlight beam: bright at the lamp (left), spreading and fading ahead (right).
  beamSprite() {
    if (this.beam) return this.beam;
    const c = document.createElement('canvas'); c.width = 128; c.height = 48;
    const x = c.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const sp = 6 + i * 3.4, a = 0.12 - i * 0.015;
      const g = x.createLinearGradient(4, 0, 124, 0); g.addColorStop(0, `rgba(255,244,210,${a * 2})`); g.addColorStop(1, 'rgba(255,240,200,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(4, 24 - 2); x.lineTo(124, 24 - sp * 1.8); x.lineTo(124, 24 + sp * 1.8); x.lineTo(4, 24 + 2); x.closePath(); x.fill();
    }
    return (this.beam = c);
  }
  headlights(ctx, c, z, cx, cy, mode, front) {
    const k = mode === 2 ? 1 : 0.45, hx = c.px + c.dx * front, hy = c.py + c.dy * front, px = (hx - hy) * 32 * z + cx, py = (hx + hy) * 16 * z + cy;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (ctx.gpu && !this.game.fast) {
      const ang = Math.atan2((c.dx + c.dy) * 16, (c.dx - c.dy) * 32);
      ctx.globalAlpha = k; ctx.translate(px, py - 2 * z); ctx.rotate(ang);
      ctx.drawImage(this.beamSprite(), 0, -9 * z, 46 * z, 18 * z);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const bx = c.px - c.dx * front * 0.9, by = c.py - c.dy * front * 0.9, qx = (bx - by) * 32 * z + cx, qy = (bx + by) * 16 * z + cy;
      ctx.fillStyle = 'rgba(255,40,30,.55)'; ctx.beginPath(); ctx.ellipse(qx, qy - 2 * z, 2.2 * z, 1.2 * z, 0, 0, 6.3); ctx.fill();   // tail lights
    } else if (mode === 2) ctx.drawImage(this.glowSprite(), px - 18 * z, py - 8 * z, 36 * z, 18 * z);
    ctx.restore();
  }
  // Buildings and trees by the water, mirrored into it. Drawn right after the water and before the land,
  // so the land tiles cover whatever doesn't fall on water. Rippled and faded by the GPU shader.
  reflections(ctx, g, w, z, cx, cy, mode, lvl, top, mX) {
    const W = this.W, H = this.H, a = mode === 2 ? 0.5 : mode === 1 ? 0.4 : 0.36, tint = mode === 2 ? [0.85, 0.9, 1] : mode === 1 ? [1, 0.86, 0.78] : [0.8, 0.9, 1];
    for (let s = 0; s < 2 * N - 1; s++) for (let x = Math.max(0, s - N + 1); x <= Math.min(s, N - 1); x++) {
      const y = s - x, i = y * N + x; if (!w.shore[i]) continue;
      const X = (x - y) * 32 * z + cx, Y = (x + y) * 16 * z + cy;
      if (X < -mX * 3 || X > W + mX * 3 || Y < top || Y > H + 200 * z) continue;
      const k = w.kind[i]; let sp = null;
      if (k === T.EMPTY && w.tree[i]) sp = treeSprite(w.tree[i], mode);
      else if ((k === T.RES || k === T.COM || k === T.IND) && w.level[i] && !g.sites.has(i)) sp = buildingSprite(k, w.level[i], (w.variant[i] & 63), mode, g.sim.pw[i] === 1, w.shore[i]);
      else if (k === T.PARK) sp = parkSprite(w.variant[i] % 4, mode);
      sp = mip(sp, lvl); if (!sp) continue;
      const hh = (sp.c.height / sp.S) * z, ww = (sp.c.width / sp.S) * z, top0 = Y - sp.oy * z, cut = Y + 10 * z, mirror = Y + 26 * z;
      const keep = cut - top0; if (keep <= 2) continue;
      ctx.drawMirror(sp.c, 0, 0, sp.c.width, sp.c.height * keep / hh, X - sp.ox * z, 2 * mirror - cut, ww, keep, a, 0, tint[0], tint[1], tint[2]);
    }
  }
  draw(t) {
    if (!this.rain) this.rain = this.game.ambient.drops;
    const g = this.game, w = g.world, ctx = this.ctx, z = g.cam.zoom, mode = g.mode, W = this.W, H = this.H;
    if (ctx.begin) ctx.begin();
    // new pictures: a little per frame while the map moves, more when it is still (see spriteBudget in sprites.js)
    const camKey = `${g.cam.x | 0},${g.cam.y | 0},${g.cam.zoom}`;
    if (camKey !== this.camKey) { this.camKey = camKey; this.stillF = 0; } else this.stillF = (this.stillF || 0) + 1;
    const still = this.stillF > 12;
    spriteBudget.left = still ? 14 : 3;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, BG[mode][0]); bg.addColorStop(1, BG[mode][1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const cx = g.cam.x, cy = g.cam.y;
    const sx = (x, y) => (x - y) * 32 * z + cx, sy = (x, y, h = 0) => (x + y) * 16 * z + cy - h * z;
    this.drawSlab(ctx, z, cx, cy, mode);
    const mX = 40 * z, top = -340 * z;

    // ground pass: one continuous water surface, then land, roads and empty lots on top
    if (this.shoreFor !== w) this.shoreMask(w);
    const zd = z * this.dpr, lvl = zd <= 0.5 ? 2 : zd <= 1 ? 1 : 0;      // smaller sprite copies when zoomed out
    const hi = zd > 2.2 && !g.fast;                                        // close up: sharper copies of buildings
    { // wet roads after rain (dry slowly), and windows that light up one by one after dark and go out late at night
      const now = performance.now(), dt = Math.min(0.2, ((now - (this.wetT || now)) / 1000)); this.wetT = now;
      const rain = g.ambient.weather.k, want = rain > 0.15 ? Math.min(0.75, rain) : 0;
      this.wet = (this.wet || 0) + (want - (this.wet || 0)) * Math.min(1, dt * (want > (this.wet || 0) ? 0.5 : 0.025));
      const ph = (g.clock / 180) % 1;
      this.litFrac = g.timeSetting !== 'auto' ? 1 : ph < 0.62 || ph > 0.9 ? 1 : ph < 0.67 ? 0.2 + (ph - 0.62) / 0.05 * 0.8 : ph > 0.84 ? 1 - (ph - 0.84) / 0.06 * 0.5 : 1;
    }
    this.drawWater(ctx, w, z, cx, cy, t, mode);
    if (ctx.gpu && !g.fast && zd >= 0.5) this.reflections(ctx, g, w, z, cx, cy, mode, lvl, top, mX);   // land drawn next hides what isn't over water
    if (zd <= 0.7 && this.updateGround(w, mode)) this.drawGroundCache(ctx, z, cx, cy, zd);   // zoomed out: the whole ground is one cached image
    else for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const X = sx(x, y), Y = sy(x, y);
      if (X < -mX || X > W + mX || Y < -34 * z || Y > H) continue;
      this.groundTile(ctx, w, x, y, X, Y, z, mode, lvl);
      if (this.wet > 0.03 && w.kind[y * N + x] === T.ROAD && w.terrain[y * N + x] !== TERRAIN.WATER) { ctx.globalAlpha = this.wet; ctx.drawImage(this.wetSprite(mode), X - 32 * z, Y, 64 * z, 32 * z); ctx.globalAlpha = 1; }
    }
    this.shadowLayer(ctx, g, w, z, cx, cy, mode, W, H, top);       // every building's shadow, cast across roads and open ground by the sun
    // life on the water, then the objects pass in painter order
    this.boats(ctx, g, z, cx, cy, t, mode);
    const badges = [], smokeList = [], neon = [], wind = 0.7 + 0.5 * Math.sin(t * 0.07);
    // vehicles and people sorted into their tiles with two reusable arrays (no new lists or maps every frame)
    const cars = this.carsL || (this.carsL = []); cars.length = 0;
    for (const Lst of [g.traffic.cars, g.agents.drivers, g.transit.buses, g.movers.vans, g.people, g.garbage.trucks, g.disasters.responders]) for (let jx = 0; jx < Lst.length; jx++) cars.push(Lst[jx]);
    const bh = this.bHead || (this.bHead = new Int32Array(N * N).fill(-1)); if (!this.bNext || this.bNext.length < cars.length) this.bNext = new Int32Array(cars.length * 2 + 64); const bn = this.bNext, bt = this.bTouched || (this.bTouched = []);
    for (const q of bt) bh[q] = -1; bt.length = 0;
    for (let jx = cars.length - 1; jx >= 0; jx--) { const c = cars[jx], key = Math.max(0, Math.min(N - 1, Math.floor(c.py))) * N + Math.max(0, Math.min(N - 1, Math.floor(c.px))); if (bh[key] < 0) bt.push(key); bn[jx] = bh[key]; bh[key] = jx; }
    const shipB = new Map();                         // harbor ships are big, so they go in painter order with the buildings
    if (g.ships) for (const sh of g.ships.list) { const key = Math.max(0, Math.min(N - 1, Math.floor(sh.y))) * N + Math.max(0, Math.min(N - 1, Math.floor(sh.x))); (shipB.get(key) || shipB.set(key, []).get(key)).push(sh); }

    for (let s = 0; s < 2 * N - 1; s++) {
      const Yd = s * 16 * z + cy; if (Yd < top || Yd > H + 60 * z) continue;            // the whole diagonal is off screen
      const xa = Math.max(Math.max(0, s - N + 1), Math.floor((s + (-mX * 3 - cx) / (32 * z)) / 2)), xb = Math.min(Math.min(s, N - 1), Math.ceil((s + (W + mX * 3 - cx) / (32 * z)) / 2));
      for (let x = xa; x <= xb; x++) {
        const y = s - x, X = sx(x, y), Y = sy(x, y);
        if (X < -mX * 3 || X > W + mX * 3 || Y < top || Y > H + 60 * z) continue;
        const i = y * N + x, k = w.kind[i];
        if (k === T.EMPTY && w.tree[i]) {
          const sp = mip(treeSprite(w.tree[i], mode), lvl), rainK = g.ambient.weather.k, sw = z < 0.6 ? 0 : Math.sin(t * (1.3 + rainK * 1.2) + x * 0.7 + y * 1.3) * (0.022 + rainK * 0.03) * (0.6 + wind * 0.5);
          if (!sp) { /* picture not made yet (see spriteBudget): it appears in a frame or two */ }
          else if (z >= 0.6) { ctx.save(); ctx.translate(X, Y + 16 * z); ctx.rotate(sw); ctx.drawImage(sp.c, -sp.ox * z, -sp.oy * z - 16 * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z); ctx.restore(); }
          else ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);   // too small to see the sway
        }
        else if (k === T.PARK) { const sp = mip(parkSprite(w.variant[i] % 4, mode), lvl), site = g.sites.get(i); if (!sp) { /* next frame */ } else if (site) drawConstruction(ctx, site, X, Y, z, mode, t, sp, null); else ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z); }
        else if ((k === T.RES || k === T.COM || k === T.IND) && w.level[i]) {
          const shr = w.shore[i], sp = mip(buildingSprite(k, w.level[i], (w.variant[i] & 63), mode, g.sim.pw[i] === 1 && (mode !== 2 || hash(x, y, 17) < this.litFrac), shr, hi), lvl);
          const site = g.sites.get(i), lv = w.level[i];
          if (mode === 2 && ctx.gpu && !g.fast && g.sim.pw[i] === 1 && !site) {
            const r = (40 + lv * 10) * z; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.2 + lv * 0.03;
            ctx.drawImage(this.poolSprite(), X - r, Y + 16 * z - r * 0.5, r * 2, r); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          }
          if (!sp) { /* picture not made yet: it appears in a frame or two */ }
          else if (site) { const so = site.from > 0 ? mip(buildingSprite(k, site.from, (site.pv & 63), mode, g.sim.pw[i] === 1, shr), lvl) : null; drawConstruction(ctx, site, X, Y, z, mode, t, sp, so); }
          else ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
          if (!site) {
            const sm = shr ? WF_SMOKE[`${shr}${k}${lv}`] : SMOKE[`${k}${lv}`];
            if (sm && (k !== T.IND || g.sim.pw[i]) && (k !== T.RES || ((mode >= 1 || getSeason() === 2) && hash(x, y, 9) > 0.35))) smokeList.push([sm, X, Y, hash(x, y, 4)]);
            if (k === T.COM && mode === 2 && g.sim.pw[i]) neon.push([X, Y + 16 * z, lv, x, y]);
          }
          if (site) { /* no status badges while building */ }
          else if (!g.sim.pw[i]) badges.push([X, Y + 16 * z - BADGE_H[lv] * z, 'bolt']);
          else if (!g.sim.wt[i]) badges.push([X, Y + 16 * z - BADGE_H[lv] * z, 'drop']);
          else if (lv >= 2 && !g.sim.ts[i]) badges.push([X, Y + 16 * z - BADGE_H[lv] * z, 'trash']);
        } else if (k === T.SVC) {
          const bt = w.bt[i], def = BT[bt], dx = w.bo[i] & 3, dy = w.bo[i] >> 2, multi = def.w * def.d > 1, last = dx === def.w - 1 && dy === def.d - 1;
          // A building bigger than one tile is drawn in slices, each with the tile in front of it, so a neighbour standing
          // in front (a warehouse beside a landfill, say) covers it instead of the whole picture being painted over the neighbour.
          if (multi && !g.sites.has((y - dy) * N + (x - dx))) {
            const ax = x - dx, ay = y - dy, sp = mip(serviceSprite(bt, mode, def.power ? true : g.sim.pw[ay * N + ax] === 1, def.reach ? w.variant[ay * N + ax] : 0, hi), lvl);
            if (sp) this.slices(ctx, sp, sx(ax, ay), sy(ax, ay), z, sliceOf(def.w, def.d)[dy * def.w + dx]);
          }
          if (last) {
            const ax = x - dx, ay = y - dy, AX = sx(ax, ay), AY = sy(ax, ay), sp = mip(serviceSprite(bt, mode, def.power ? true : g.sim.pw[ay * N + ax] === 1, def.reach ? w.variant[ay * N + ax] : 0, hi), lvl);
            const site = g.sites.get(ay * N + ax);
            if (!sp) { /* next frame */ }
            else if (site) drawConstruction(ctx, site, AX, AY, z, mode, t, sp, null);
            else if (!multi) ctx.drawImage(sp.c, AX - sp.ox * z, AY - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
            if (!site) { const sm = SMOKE['s' + bt]; if (sm && (def.power || bt === 16 || g.sim.pw[ay * N + ax] === 1)) smokeList.push([sm, AX, AY, hash(ax, ay, 4)]); }
            if (!site && SVC_FLAGS[bt] && z >= 0.4) for (const f of SVC_FLAGS[bt]) this.flag(ctx, sx(ax + f[0], ay + f[1]), sy(ax + f[0], ay + f[1], f[2]), z, t, mode, f[3], g.fast, hash(ax, ay, f[0] * 7));
            if (bt === 2 && (!site || site.t / site.dur > 0.93)) this.blades(ctx, sx(ax + 0.5, ay + 0.5), sy(ax + 0.5, ay + 0.5, 74), z, t, mode);
            if (!site && g.sim.closed(def)) badges.push([sx(ax + def.w / 2, ay + def.d / 2), sy(ax + def.w / 2, ay + def.d / 2, 66), 'closed']);
            else if (!site && def.use && !g.sim.pw[ay * N + ax]) badges.push([sx(ax + def.w / 2, ay + def.d / 2), sy(ax + def.w / 2, ay + def.d / 2, 66), 'bolt']);
          }
        } else if (k === T.ROAD && mode === 2 && hash(x, y, 3) > 0.72 && g.sim.powerMap[i] === 3) {
          const gs = this.glowSprite(); ctx.globalCompositeOperation = 'lighter';
          if (ctx.gpu && !g.fast) { ctx.globalAlpha = 0.75; ctx.drawImage(this.poolSprite(), X - 50 * z, Y - 9 * z, 100 * z, 50 * z); ctx.globalAlpha = 1; ctx.drawImage(gs, X - 9 * z, Y - 5 * z, 18 * z, 9 * z); }
          else ctx.drawImage(gs, X - 48 * z * 0.8, Y - 8 * z, 96 * z * 0.8, 48 * z * 0.8);
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#3a3d44'; ctx.lineWidth = 1.4 * z; ctx.beginPath(); ctx.moveTo(X, Y + 16 * z); ctx.lineTo(X, Y + 16 * z - 16 * z); ctx.stroke();
          ctx.fillStyle = '#fff2b8'; ctx.beginPath(); ctx.arc(X, Y + 16 * z - 17 * z, 2 * z, 0, 6.3); ctx.fill();
        }
        if (z >= 0.5 && k === T.ROAD && !w.hw[i] && w.terrain[i] !== TERRAIN.WATER) this.street(ctx, w, x, y, X, Y, z, mode, lvl);
        if (z >= 0.5 && k === T.ROAD && isSignal(w, x, y)) this.signal(ctx, x, y, X, Y, z, g.clock, mode);
        if (k === T.ROAD && w.edgeOpen(x, y)) this.highwaySign(ctx, X, Y, z, mode);
        const rub = g.disasters.rubble.get(i);
        if (rub !== undefined && (k === T.EMPTY || (k >= 2 && k <= 4 && !w.level[i]))) this.rubble(ctx, i, X, Y, z, rub, mode);
        const fire = g.disasters.fires.get(i);
        if (fire) this.fire(ctx, fire, X, Y, z, t, mode, k === T.SVC ? 56 : [30, 54, 94, 180][Math.max(0, w.level[i] - 1)] || 40);
        if (z >= 0.5 && w.pipe[i] && (x + y) % 3 === 0 && !w.tree[i] && (k === T.EMPTY || k === T.ROAD || k === T.PARK)) this.manhole(ctx, X, Y, z, mode);
        if (z >= 0.45 && w.wire[i] === 1) this.pole(ctx, w, x, y, X, Y, z, mode);
        const sb = shipB.size ? shipB.get(i) : null;
        if (sb) for (const sh of sb) this.ship(ctx, sh, w, z, cx, cy, t, mode);
        for (let jj = bh[y * N + x]; jj >= 0; jj = bn[jj]) { const c = cars[jj]; if (c.ped) { if (z >= 0.5) this.person(ctx, c, z, cx, cy, mode, t); } else if (c.truck) this.truck(ctx, c, z, cx, cy, mode, t); else if (c.bus) this.bus(ctx, c, z, cx, cy, mode); else this.car(ctx, c, z, cx, cy, mode); }
      }
    }
    if (z >= 0.35) for (const [list, X, Y, seed] of smokeList) drawSmoke(ctx, list, X, Y, z, t, mode, seed, wind);
    if (neon.length) this.neon(ctx, neon, z, t);
    this.clouds(ctx, g, z, cx, cy, t, mode);
    if (z >= 0.4) this.birds(ctx, g, z, cx, cy, t, mode);
    if (z >= 0.45 && !g.fast && g.ships) this.gulls(ctx, g, z, cx, cy, t, mode);
    if (g.disasters.tornado) this.tornado(ctx, g.disasters.tornado, z, cx, cy, t, mode);
    if (g.disasters.ufo) this.ufo(ctx, g.disasters.ufo, z, cx, cy, t, mode);
    if (g.overlay) this.overlay(ctx, g, z, cx, cy);
    for (const b of badges) this.badge(ctx, b[0], b[1] - Math.sin(t * 3 + b[0]) * 1.5 * z, z, b[2]);
    if (g.sel) this.selection(ctx, g.sel, z, cx, cy, t);
    // preview
    if (g.preview) {
      for (const p of g.preview.tiles) {
        const X = sx(p.x, p.y), Y = sy(p.x, p.y);
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + 32 * z, Y + 16 * z); ctx.lineTo(X, Y + 32 * z); ctx.lineTo(X - 32 * z, Y + 16 * z); ctx.closePath();
        ctx.fillStyle = p.ok ? 'rgba(242,184,75,.38)' : 'rgba(239,111,94,.42)'; ctx.fill();
        ctx.strokeStyle = p.ok ? 'rgba(242,184,75,.95)' : 'rgba(239,111,94,.95)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
    this.weather(ctx, g, t, mode);
    if (!g.fast) this.grade(ctx, mode);
    this.vignette(ctx, mode);
    if (still) this.warm(g, w, mode, lvl, z);
    if (ctx.end) ctx.end();
  }
  // While the map is still, get the pictures around the view ready (made and sent to the GPU) a few at a time,
  // so that dragging the map later shows them at once instead of making them mid-drag.
  warm(g, w, mode, lvl, z) {
    const t0 = performance.now(), W = this.W, H = this.H, cx = g.cam.x, cy = g.cam.y, ctx = this.ctx;
    const inv = (X, Y) => { const u = (X - cx) / (32 * z), v = (Y - cy) / (16 * z); return [(u + v) / 2, (v - u) / 2]; };
    const cs = [inv(-W * 0.6, -H * 0.6), inv(W * 1.6, -H * 0.6), inv(-W * 0.6, H * 1.6), inv(W * 1.6, H * 1.6)];
    const x0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[0])))), x1 = Math.min(N - 1, Math.ceil(Math.max(...cs.map((c) => c[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[1])))), y1 = Math.min(N - 1, Math.ceil(Math.max(...cs.map((c) => c[1]))));
    const span = (x1 - x0 + 1) * (y1 - y0 + 1); if (span <= 0) return;
    const key = `${x0},${y0},${x1},${y1},${mode},${lvl}`;
    if (key !== this.warmKey) { this.warmKey = key; this.warmI = 0; }
    const send = (sp) => { if (sp && ctx.entry && ctx.canWarm()) ctx.entry(sp.c); };
    while (this.warmI < span && performance.now() - t0 < 1.5 && spriteBudget.left > 0) {
      const x = x0 + (this.warmI % (x1 - x0 + 1)), y = y0 + Math.floor(this.warmI / (x1 - x0 + 1)); this.warmI++;
      const i = y * N + x, k = w.kind[i];
      if (k === T.EMPTY && w.tree[i]) send(mip(treeSprite(w.tree[i], mode), lvl));
      else if (k === T.PARK) send(mip(parkSprite(w.variant[i] % 4, mode), lvl));
      else if ((k === T.RES || k === T.COM || k === T.IND) && w.level[i]) send(mip(buildingSprite(k, w.level[i], (w.variant[i] & 63), mode, g.sim.pw[i] === 1, w.shore[i]), lvl));
      else if (k === T.SVC && w.bo[i] === 0) { const def = BT[w.bt[i]]; send(mip(serviceSprite(w.bt[i], mode, def.power ? true : g.sim.pw[i] === 1, def.reach ? w.variant[i] : 0), lvl)); }
    }
  }
  // Color grading: aerial haze toward the far (upper) part of the view and a soft sunlight wash.
  grade(ctx, mode) {
    const W = this.W, H = this.H;
    const haze = mode === 2 ? 'rgba(24,34,80,' : mode === 1 ? 'rgba(255,186,140,' : 'rgba(208,228,248,';
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    g.addColorStop(0, haze + (mode === 2 ? 0.16 : mode === 1 ? 0.1 : 0.13) + ')'); g.addColorStop(1, haze + '0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.55);
    if (mode === 1 && ctx.gpu) {                              // low sun from the upper right: warm light raking across the city
      const s = ctx.createLinearGradient(W, 0, W * 0.25, H);
      s.addColorStop(0, 'rgba(255,150,70,.26)'); s.addColorStop(0.55, 'rgba(255,120,60,.08)'); s.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = s; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }
  signal(ctx, x, y, X, Y, z, sigT, mode) {
    const stV = light(sigT, x, y, true), stH = light(sigT, x, y, false), key = stV + stH + mode;
    this.sigC = this.sigC || {}; let c = this.sigC[key];
    if (!c) { c = this.sigC[key] = document.createElement('canvas'); c.width = 128; c.height = 76; const x2 = c.getContext('2d'); x2.scale(2, 2); this.signalPaint(x2, 32, 20, 1, stV, stH, mode); }
    ctx.drawImage(c, X - 32 * z, Y - 20 * z, 64 * z, 38 * z);
    if (mode > 0 || stV === 'r' || stH === 'r') {                       // the lit lamps glow
      ctx.globalCompositeOperation = 'lighter'; const gs = this.glowSprite();
      for (const [lx, ly, st] of [[0.94, 0.07, stV], [0.07, 0.94, stH]]) {
        if (mode === 0 && st !== 'r') continue;
        const dy = st === 'r' ? 2.4 : st === 'y' ? 6.6 : 10.8, gx = X + (lx - ly) * 32 * z, gy = Y + (lx + ly) * 16 * z - 26 * z - 3 * z + dy * z * 0.95;
        ctx.globalAlpha = mode === 2 ? 0.9 : 0.55; ctx.drawImage(gs, gx - 8 * z, gy - 4 * z, 16 * z, 8 * z);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  signalPaint(ctx, X, Y, z, stV, stH, mode) {
    const P = (lx, ly, h = 0) => [X + (lx - ly) * 32 * z, Y + (lx + ly) * 16 * z - h * z];
    const heads = [[0.94, 0.07, true], [0.07, 0.94, false]], d = mode === 2 ? 0.6 : 1;
    for (const [lx, ly, vertical] of heads) {
      const b = P(lx, ly), t = P(lx, ly, 26), st = vertical ? stV : stH;
      ctx.strokeStyle = `rgb(${70 * d | 0},${74 * d | 0},${82 * d | 0})`; ctx.lineWidth = 1.5 * z; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(t[0], t[1]); ctx.stroke();
      ctx.fillStyle = `rgb(${34 * d | 0},${37 * d | 0},${44 * d | 0})`; ctx.fillRect(t[0] - 2.6 * z, t[1] - 3 * z, 5.2 * z, 12 * z);
      const cols = [['r', '#ff4b3e', 2.4], ['y', '#ffc93a', 6.6], ['g', '#3ddc6a', 10.8]];
      for (const [k, c, dy] of cols) {
        const on = st === k; ctx.fillStyle = on ? c : `rgba(70,74,84,${0.9})`; ctx.beginPath(); ctx.arc(t[0], t[1] - 3 * z + dy * z * 0.95, 1.5 * z, 0, 6.3); ctx.fill();
      }
    }
  }
  bus(ctx, c, z, cx, cy, mode) {
    const P = (x, y, h = 0) => [(x - y) * 32 * z + cx, (x + y) * 16 * z + cy - h * z], d = mode === 2 ? 0.45 : mode === 1 ? 0.85 : 1;
    const sh = (hex, f) => { const h = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, ((h >> 16) & 255) * f * d) | 0},${Math.min(255, ((h >> 8) & 255) * f * d) | 0},${Math.min(255, (h & 255) * f * d) | 0})`; };
    const poly = (a, f) => { ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) ctx.lineTo(a[i][0], a[i][1]); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); };
    const horiz = c.dx !== 0, l = 0.64, wd = 0.19, bw = horiz ? l : wd, bd = horiz ? wd : l, x = c.px - bw / 2, y = c.py - bd / 2, h1 = 10.5, col = c.col;
    poly([P(x, y + bd, 1), P(x + bw, y + bd, 1), P(x + bw, y + bd, h1), P(x, y + bd, h1)], sh(col, 1));
    poly([P(x + bw, y, 1), P(x + bw, y + bd, 1), P(x + bw, y + bd, h1), P(x + bw, y, h1)], sh(col, 0.76));
    poly([P(x, y, h1), P(x + bw, y, h1), P(x + bw, y + bd, h1), P(x, y + bd, h1)], sh('#dfe3e8', 1));
    const win = mode === 2 ? '#ffe9a8' : '#cfe6f3';
    if (horiz) poly([P(x + 0.04, y + bd, 5), P(x + bw - 0.04, y + bd, 5), P(x + bw - 0.04, y + bd, 9.4), P(x + 0.04, y + bd, 9.4)], sh(win, 1));
    else poly([P(x + bw, y + 0.04, 5), P(x + bw, y + bd - 0.04, 5), P(x + bw, y + bd - 0.04, 9.4), P(x + bw, y + 0.04, 9.4)], sh(win, 0.9));
    ctx.fillStyle = sh('#2b2e36', 1); const q = P(c.px - c.dx * 0.2, c.py - c.dy * 0.2); ctx.beginPath(); ctx.ellipse(q[0], q[1], 2.6 * z, 1.3 * z, 0, 0, 6.3); ctx.fill();
    if (mode === 2 || (mode === 1 && ctx.gpu)) this.headlights(ctx, c, z, cx, cy, mode, 0.34);
  }
  // Boats of every kind, with wakes behind them and small lights at night. A boat under a bridge is hidden by the deck.
  boats(ctx, g, z, cx, cy, t, mode) {
    const d = mode === 2 ? 0.5 : mode === 1 ? 0.85 : 1, w = g.world;
    const rgb = (r, gg, b) => `rgb(${(r * d) | 0},${(gg * d) | 0},${(b * d) | 0})`;
    const ell = (x, y, rx, ry, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.3); ctx.fill(); };
    for (const b of g.fleet.boats) {
      const X = (b.x - b.y) * 32 * z + cx, Y = (b.x + b.y) * 16 * z + cy;
      if (X < -80 || X > this.W + 80 || Y < -80 || Y > this.H + 80) continue;
      const under = (px, py) => { const xx = Math.floor(px), yy = Math.floor(py); return xx >= 0 && yy >= 0 && xx < N && yy < N && w.kind[yy * N + xx] === T.ROAD; };
      if (under(b.x, b.y) || under(b.x - 0.35, b.y) || under(b.x, b.y - 0.35)) continue;   // passing under a bridge
      if (b.type === 'duck' && z < 0.45) continue;
      const ang = Math.atan2((Math.cos(b.a) + Math.sin(b.a)) * 16, (Math.cos(b.a) - Math.sin(b.a)) * 32), ca = Math.cos(ang), sa = Math.sin(ang);
      const bob = Math.sin(t * 2 + b.col) * 0.6 * z;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, b.fade)); ctx.translate(X, Y + bob);
      if (b.type === 'duck') {                                // a duck with ducklings in a line behind
        for (let j = b.n; j >= 0; j--) {
          const s = j ? 0.65 : 1, bx = -ca * (3.2 + j * 2.6) * z * (j ? 1 : 0), by = -sa * (3.2 + j * 2.6) * z * 0.5 * (j ? 1 : 0) + Math.sin(t * 3 + j) * 0.3 * z;
          ell(bx, by, 1.9 * s * z, 1.1 * s * z, j ? rgb(196, 170, 120) : rgb(120, 96, 70));
          ell(bx + ca * 1.4 * s * z, by - 0.9 * s * z, 0.8 * s * z, 0.8 * s * z, j ? rgb(205, 180, 125) : rgb(40, 110, 70));
        }
        ctx.restore(); continue;
      }
      const L = { row: 5, pedal: 4.5, fish: 9, sail: 8, motor: 7.5 }[b.type], Wd = { row: 1.9, pedal: 2.6, fish: 3.2, sail: 3, motor: 2.6 }[b.type];
      if (b.moving) {                                       // wake: a soft trail and a V of foam behind the boat
        const k = b.type === 'motor' ? 2.2 : b.type === 'sail' ? 1.3 : 0.8;
        ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(-ca * (L + 5 * k) * z, -sa * (L + 5 * k) * z, (5 + 6 * k) * z, (1.6 + k) * z, ang, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 0.8 * z; ctx.beginPath();
        for (const sgn of [-1, 1]) { ctx.moveTo(-ca * L * 0.6 * z, -sa * L * 0.6 * z); ctx.lineTo((-ca * (L + 12 * k) - sa * sgn * 4 * k) * z, (-sa * (L + 12 * k) + ca * sgn * 4 * k) * z); }
        ctx.stroke();
      }
      ctx.rotate(ang);
      if (b.type === 'row') {
        ell(0, 0, L * z, Wd * z, rgb(139, 94, 52)); ell(0, 0, (L - 1) * z, (Wd - 0.6) * z, rgb(178, 132, 84));
        ctx.strokeStyle = rgb(110, 80, 50); ctx.lineWidth = 0.6 * z; ctx.beginPath(); const oar = Math.sin(t * 2.4 + b.col) * 1.5 * z;
        ctx.moveTo(-0.5 * z, 0); ctx.lineTo(-2 * z + oar, -5.5 * z); ctx.moveTo(-0.5 * z, 0); ctx.lineTo(-2 * z + oar, 5.5 * z); ctx.stroke();
        ctx.rotate(-ang); ell(0, -1.6 * z, 1.1 * z, 1.4 * z, rgb([220, 60, 60, 200, 240][b.col] || 200, [70, 120, 160, 80, 190][b.col] || 80, [60, 200, 70, 190, 60][b.col] || 60));
        ell(0, -3.2 * z, 0.8 * z, 0.8 * z, rgb(224, 180, 140));
      } else if (b.type === 'pedal') {
        const c = [[240, 120, 150], [90, 170, 230], [250, 200, 70], [120, 210, 140], [240, 240, 240]][b.col];
        ell(0, 0, L * z, Wd * z, rgb(...c)); ell(0, 0, (L - 1.2) * z, (Wd - 0.8) * z, rgb(250, 250, 250));
        ctx.rotate(-ang); ctx.fillStyle = rgb(...c); ctx.fillRect(-2.4 * z, -5.6 * z, 4.8 * z, 1.3 * z);
        ctx.strokeStyle = rgb(230, 230, 230); ctx.lineWidth = 0.5 * z; ctx.beginPath(); ctx.moveTo(-2 * z, -4.3 * z); ctx.lineTo(-2 * z, -0.5 * z); ctx.moveTo(2 * z, -4.3 * z); ctx.lineTo(2 * z, -0.5 * z); ctx.stroke();
      } else if (b.type === 'fish') {
        ell(0, 0, L * z, Wd * z, rgb(...[[44, 82, 130], [160, 50, 45], [40, 110, 90], [60, 60, 70], [200, 120, 40]][b.col])); ell(0.5 * z, 0, (L - 1.4) * z, (Wd - 1) * z, rgb(200, 190, 170));
        ctx.rotate(-ang); ctx.fillStyle = rgb(240, 240, 235); ctx.fillRect(-ca * 3 * z - 2.2 * z, -sa * 3 * z - 5.5 * z, 4.4 * z, 4.5 * z);
        ctx.fillStyle = rgb(80, 120, 150); ctx.fillRect(-ca * 3 * z - 1.6 * z, -sa * 3 * z - 4.6 * z, 3.2 * z, 1.4 * z);
        ctx.strokeStyle = rgb(70, 60, 50); ctx.lineWidth = 0.6 * z; ctx.beginPath(); ctx.moveTo(ca * 3 * z, sa * 3 * z); ctx.lineTo(ca * 3 * z, sa * 3 * z - 11 * z); ctx.lineTo(ca * 6 * z, sa * 6 * z - 2 * z); ctx.stroke();
      } else if (b.type === 'motor') {
        ell(0, 0, L * z, Wd * z, rgb(245, 245, 245)); ell(-0.6 * z, 0, (L - 1.6) * z, (Wd - 0.9) * z, rgb(...[[200, 60, 50], [40, 90, 170], [30, 30, 40], [230, 160, 40], [30, 140, 140]][b.col]));
        ctx.fillStyle = rgb(160, 210, 235); ctx.fillRect(1 * z, -1.4 * z, 1.4 * z, 2.8 * z);
      } else {                                              // sailboat
        ell(0, 0, L * z, Wd * z, b.col % 2 ? rgb(235, 235, 230) : rgb(60, 90, 140)); ctx.fillStyle = rgb(120, 80, 50); ctx.fillRect(-4 * z, -1 * z, 8 * z, 1.2 * z);
        ctx.rotate(-ang); ctx.fillStyle = rgb(250, 250, 250); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.6 * z;
        ctx.beginPath(); ctx.moveTo(0, -2 * z); ctx.lineTo(0, -17 * z); ctx.lineTo(8 * z * (ca >= 0 ? 1 : -1), -4 * z); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      if (mode === 2 && b.type !== 'row' && b.type !== 'pedal') {   // running light
        ctx.save(); ctx.globalAlpha = b.fade; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glowSprite(), X - 9 * z, Y - 6 * z, 18 * z, 9 * z); ctx.restore();
        ctx.fillStyle = 'rgba(255,240,190,.95)'; ctx.fillRect(X - 0.8 * z, Y - 3 * z + bob, 1.6 * z, 1.6 * z);
      }
    }
  }

  // Harbor ships: cargo ships from the open sea (bigger at bigger harbors) and barges pushed by a small tug on inland water.
  ship(ctx, s, w, z, cx, cy, t, mode) {
    const d = mode === 2 ? 0.5 : mode === 1 ? 0.85 : 1;
    const rgb = (r, gg, b) => `rgb(${(r * d) | 0},${(gg * d) | 0},${(b * d) | 0})`;
    const ell = (x, y, rx, ry, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.3); ctx.fill(); };
    {
      const X = (s.x - s.y) * 32 * z + cx, Y = (s.x + s.y) * 16 * z + cy;
      if (X < -160 * z || X > this.W + 160 * z || Y < -120 * z || Y > this.H + 120 * z) return;
      const ang = Math.atan2((Math.cos(s.a) + Math.sin(s.a)) * 16, (Math.cos(s.a) - Math.sin(s.a)) * 32), ca = Math.cos(ang), sa = Math.sin(ang);
      const bob = Math.sin(t * 1.3 + s.col) * 0.35 * z, cargo = s.kind === 'cargo', yacht = s.kind === 'yacht', ferry = s.kind === 'ferry';
      const L = cargo ? [13, 13, 13, 17, 21][s.size] : yacht ? 6 : ferry ? 9 : 11, Wd = cargo ? [3.4, 3.4, 3.4, 4, 4.6][s.size] : yacht ? 2 : ferry ? 3.3 : 3.2;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, s.fade)); ctx.translate(X, Y + bob);
      if (s.moving) {                                      // wake: a long soft trail and a V of foam
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(-ca * (L + 10) * z, -sa * (L + 10) * z, (12 + L * 0.4) * z, (2.4 + Wd * 0.3) * z, ang, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 0.9 * z; ctx.beginPath();
        for (const sgn of [-1, 1]) { ctx.moveTo(ca * L * 0.7 * z, sa * L * 0.7 * z); ctx.lineTo((-ca * (L + 16) - sa * sgn * 7) * z, (-sa * (L + 16) + ca * sgn * 7) * z); }
        ctx.stroke();
      }
      ctx.save(); ctx.rotate(ang);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(1.2 * z, 1.4 * z, (L + 1) * z, (Wd + 0.6) * z, 0, 0, 6.3); ctx.fill();   // shadow on the water
      if (yacht || ferry) {                                 // a white hull, pointed at the bow
        ctx.fillStyle = rgb(244, 244, 240); ctx.beginPath(); ctx.moveTo(-L * z, -Wd * z); ctx.lineTo(L * 0.55 * z, -Wd * z); ctx.quadraticCurveTo(L * z, -Wd * 0.4 * z, L * 1.08 * z, 0);
        ctx.quadraticCurveTo(L * z, Wd * 0.4 * z, L * 0.55 * z, Wd * z); ctx.lineTo(-L * z, Wd * z); ctx.closePath(); ctx.fill();
        ctx.fillStyle = ferry ? rgb(47, 111, 168) : rgb(...HULL[s.col]); ctx.fillRect(-L * z, (Wd - 0.6) * z, L * 1.5 * z, 0.6 * z);
        if (yacht) { ctx.fillStyle = rgb(196, 160, 110); ctx.fillRect(-L * 0.8 * z, -(Wd - 0.6) * z, L * 0.7 * z, (Wd - 0.6) * 2 * z); }
        else { ctx.fillStyle = rgb(236, 238, 240); ctx.fillRect(-L * 0.75 * z, -(Wd - 0.6) * z, L * 1.35 * z, (Wd - 0.6) * 2 * z); }
      } else if (cargo) {
        const hc = HULL[s.col];
        ctx.fillStyle = rgb(...hc); ctx.beginPath();
        ctx.moveTo(-L * z, -Wd * z); ctx.lineTo(L * 0.62 * z, -Wd * z); ctx.quadraticCurveTo(L * z, -Wd * 0.5 * z, L * 1.05 * z, 0);
        ctx.quadraticCurveTo(L * z, Wd * 0.5 * z, L * 0.62 * z, Wd * z); ctx.lineTo(-L * z, Wd * z); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgb(176, 58, 46); ctx.fillRect(-L * z, (Wd - 0.7) * z, L * 1.6 * z, 0.7 * z);       // red waterline
        ctx.fillStyle = rgb(150, 150, 146); ctx.fillRect(-(L - 1) * z, -(Wd - 0.8) * z, (L * 1.55) * z, (Wd - 0.8) * 2 * z);   // deck
        if (s.load) {                                      // containers in rows from the bridge to the bow
          const n = Math.max(2, Math.floor((L * 1.2) / 3.1)), bw = (Wd - 1) * 2;
          for (let j = 0; j < n; j++) {
            const bx = (-L * 0.5 + j * 3.1) * z;
            for (let r = 0; r < 2; r++) { const c = BOX[(s.col * 3 + j * 2 + r * 5) % BOX.length]; ctx.fillStyle = rgb(...c); ctx.fillRect(bx, (-(Wd - 1) + r * bw / 2) * z, 2.7 * z, (bw / 2 - 0.25) * z); }
          }
        }
      } else {                                             // barge with a heap of sand, gravel or coal, and the tug that pushes it
        ell(-(L + 3.4) * z, 0, 3.6 * z, 2.1 * z, rgb(...[[200, 60, 50], [240, 240, 235], [50, 90, 150], [230, 160, 40], [40, 120, 90]][s.col]));
        ctx.fillStyle = rgb(70, 62, 56); ctx.fillRect(-L * z, -Wd * z, L * 2 * z, Wd * 2 * z);
        ctx.fillStyle = rgb(96, 86, 76); ctx.fillRect(-(L - 0.8) * z, -(Wd - 0.7) * z, (L * 2 - 1.6) * z, (Wd - 0.7) * 2 * z);
        if (s.load) { const c = CARGO[s.col]; for (let j = 0; j < 3; j++) ell((-L * 0.55 + j * L * 0.55) * z, 0, L * 0.3 * z, (Wd - 1) * z, rgb(...c)); }
      }
      ctx.restore();
      // superstructure stands upright: the bridge at the stern of a cargo ship, the tug's cabin behind a barge
      if (yacht) {                                          // mast and a furled sail, or the sail set when under way
        ctx.strokeStyle = rgb(220, 220, 220); ctx.lineWidth = 0.8 * z; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16 * z); ctx.stroke();
        if (s.moving) { ctx.fillStyle = rgb(250, 250, 250); ctx.beginPath(); ctx.moveTo(0, -2 * z); ctx.lineTo(0, -15 * z); ctx.lineTo(6 * z * (ca >= 0 ? 1 : -1), -3 * z); ctx.closePath(); ctx.fill(); }
      } else if (ferry) {                                   // two decks of windows and a blue funnel
        ctx.fillStyle = rgb(240, 242, 244); ctx.fillRect(-5 * z, -6 * z, 10 * z, 5.5 * z);
        ctx.fillStyle = mode === 2 ? '#ffe7a0' : rgb(60, 95, 130); ctx.fillRect(-4.4 * z, -5.2 * z, 8.8 * z, 1.2 * z); ctx.fillRect(-4.4 * z, -2.8 * z, 8.8 * z, 1.2 * z);
        ctx.fillStyle = rgb(47, 111, 168); ctx.fillRect(-0.9 * z, -8.6 * z, 1.8 * z, 2.7 * z);
      } else if (cargo) {
        const px = -ca * L * 0.78 * z, py = -sa * L * 0.78 * z, bh = (4 + s.size) * z;
        ctx.fillStyle = rgb(236, 236, 230); ctx.fillRect(px - 2.6 * z, py - bh, 5.2 * z, bh);
        ctx.fillStyle = mode === 2 ? '#ffe7a0' : rgb(70, 110, 140); ctx.fillRect(px - 2.2 * z, py - bh + 0.8 * z, 4.4 * z, 1.1 * z);
        ctx.fillStyle = rgb(196, 62, 48); ctx.fillRect(px - 0.8 * z, py - bh - 2.2 * z, 1.6 * z, 2.3 * z);    // funnel
        if (s.size >= 3) { ctx.fillStyle = rgb(236, 236, 230); ctx.fillRect(px - 1.8 * z, py - bh - 0.6 * z, 3.6 * z, 0.7 * z); }
      } else {
        const px = -ca * (L + 3.8) * z, py = -sa * (L + 3.8) * z;
        ctx.fillStyle = rgb(240, 240, 232); ctx.fillRect(px - 1.4 * z, py - 3.6 * z, 2.8 * z, 3.2 * z);
        ctx.fillStyle = mode === 2 ? '#ffe7a0' : rgb(70, 110, 140); ctx.fillRect(px - 1.1 * z, py - 3 * z, 2.2 * z, 0.9 * z);
      }
      ctx.restore();
      if (mode >= 1) {                                     // running lights at dusk and night: a white masthead light and a warm glow
        const k = mode === 2 ? 1 : 0.5, back = cargo ? L * 0.78 : yacht || ferry ? 0 : L + 3.8, hx = X - ca * back * z, hy = Y + bob - sa * back * z;
        ctx.save(); ctx.globalAlpha = s.fade * k; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glowSprite(), hx - 12 * z, hy - 9 * z, 24 * z, 12 * z);
        ctx.drawImage(this.glowSprite(), X + ca * L * z - 6 * z, Y + bob + sa * L * z - 4 * z, 12 * z, 6 * z); ctx.restore();
        ctx.fillStyle = `rgba(255,244,210,${0.95 * s.fade * k})`; ctx.fillRect(hx - 0.8 * z, hy - (cargo ? 8 + s.size : yacht ? 17 : ferry ? 10 : 5) * z, 1.6 * z, 1.6 * z);
      }
    }
  }

  // A band of the neighbour's ground (sand or grass) feathered in from one edge of a tile, with a few ragged blobs.
  edgeSprite(nt, side, mode, season) {
    const key = nt * 64 + side * 16 + mode * 4 + season; this.edges = this.edges || new Map(); let c = this.edges.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
    x.beginPath(); x.moveTo(64, 0); x.lineTo(128, 32); x.lineTo(64, 64); x.lineTo(0, 32); x.closePath(); x.clip();
    const E = [[[64, 0], [128, 32]], [[128, 32], [64, 64]], [[64, 64], [0, 32]], [[0, 32], [64, 0]]][side], mx = (E[0][0] + E[1][0]) / 2, my = (E[0][1] + E[1][1]) / 2;
    const col = nt === TERRAIN.SAND ? (season === 2 ? [235, 227, 200] : [227, 211, 158]) : season === 2 ? [200, 212, 196] : season === 1 ? [184, 186, 110] : [150, 196, 112];
    const dk = mode === 2 ? 0.5 : mode === 1 ? 0.88 : 1, rgb = (a) => `rgba(${(col[0] * dk) | 0},${(col[1] * dk) | 0},${(col[2] * dk) | 0},${a})`;
    const g = x.createLinearGradient(mx, my, 64, 32); g.addColorStop(0, rgb(0.85)); g.addColorStop(0.45, rgb(0)); x.fillStyle = g; x.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 6; i++) { const u = 0.1 + i * 0.16, px = E[0][0] + (E[1][0] - E[0][0]) * u, py = E[0][1] + (E[1][1] - E[0][1]) * u; x.fillStyle = rgb(0.55); x.beginPath(); x.ellipse(px + (64 - px) * 0.08, py + (32 - py) * 0.08, 7 + (i % 3) * 3, 3 + (i % 2) * 1.5, 0, 0, 6.3); x.fill(); }
    this.edges.set(key, c); return c;
  }
  // Where the sun is: shadow direction in tile units (dx, dy) per tile of height, and how dark. Null at night.
  sun(g, mode) {
    if (mode === 2) return null;
    let ph = (g.clock / 180) % 1;
    if (g.timeSetting !== 'auto') ph = mode === 1 ? 0.53 : 0.2;
    const t = ph >= 0.9 ? 0 : Math.min(1, ph / 0.55), th = t * Math.PI / 2;            // sunrise: shadows to +x; sunset: to +y
    const len = Math.min(3, 0.35 + 2.4 * Math.pow(Math.abs(t - 0.5) * 2, 2));
    return { dx: Math.cos(th) * len, dy: Math.sin(th) * len, a: mode === 1 ? 0.38 : 0.32 };
  }
  // All building shadows go into one small canvas as solid shapes, then onto the view at once with one opacity, so where
  // shadows overlap they don't get darker, and the small size makes their edges soft for free. Drawn after the ground and
  // before the buildings: shadows fall on roads, water and open land.
  shadowLayer(ctx, g, w, z, cx, cy, mode, W, H, top) {
    const sun = this.sun(g, mode); if (!sun || z < 0.3) return;
    const q = 0.25, cw = Math.max(8, Math.ceil(W * q)), ch = Math.max(8, Math.ceil(H * q));
    let c = this.shc; if (!c) { c = this.shc = document.createElement('canvas'); c._solo = true; this.shx = c.getContext('2d'); }
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const sk = `${cx | 0},${cy | 0},${z},${cw},${sun.dx.toFixed(2)},${g.sim.day},${g.sites.size}`;
    if (sk === this.shKey) { if (this.shAny) { ctx.globalAlpha = sun.a; ctx.drawImage(c, 0, 0, cw / q, ch / q); ctx.globalAlpha = 1; } return; }   // nothing moved: reuse last frame's shadows
    this.shKey = sk;
    const x2 = this.shx; x2.setTransform(1, 0, 0, 1, 0, 0); x2.clearRect(0, 0, cw, ch); x2.fillStyle = '#0a1426'; x2.beginPath();
    let any = false;
    const pt = (u, v, first) => { const X = ((u - v) * 32 * z + cx) * q, Y = ((u + v) * 16 * z + cy) * q; if (first) x2.moveTo(X, Y); else x2.lineTo(X, Y); };
    const add = (x0, y0, fw, fd, h) => {                 // a box swept away from the sun: with dx, dy >= 0 that is always this hexagon
      const k = Math.min(6, h / 32), ox = sun.dx * k, oy = sun.dy * k, x1 = x0 + fw, y1 = y0 + fd;
      pt(x0, y0, true); pt(x1, y0); pt(x1 + ox, y0 + oy); pt(x1 + ox, y1 + oy); pt(x0 + ox, y1 + oy); pt(x0, y1); x2.closePath(); any = true;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const X = (x - y) * 32 * z + cx, Y = (x + y) * 16 * z + cy;
      if (X < -260 * z || X > W + 260 * z || Y < -260 * z || Y > H + 40 * z) continue;
      const i = y * N + x, k = w.kind[i];
      if ((k === T.RES || k === T.COM || k === T.IND) && w.level[i] && !g.sites.has(i)) add(x + 0.12, y + 0.12, 0.76, 0.76, REAL_H[k][w.level[i] - 1] * 0.8);
      else if (k === T.SVC && w.bo[i] === 0 && !g.sites.has(i)) { const def = BT[w.bt[i]]; if (!def.reach) add(x + 0.1, y + 0.1, def.w - 0.2, def.d - 0.2, (SVC_H[def.key] || 40) * 0.7); }
    }
    this.shAny = any; if (!any) return;
    x2.fill(); touched(c);
    ctx.globalAlpha = sun.a; ctx.drawImage(c, 0, 0, cw / q, ch / q); ctx.globalAlpha = 1;
  }
  // Street life on a road tile: trees along the pavement in front of homes, cars parked at the kerb by shops and offices,
  // benches and bins by parks. Placed by a hash of the tile, so they stay put.
  street(ctx, w, x, y, X, Y, z, mode, lvl) {
    const cxT = X, cyT = Y + 16 * z;
    for (let s = 0; s < 4; s++) {
      const [dx, dy] = D4R[s], nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const q = ny * N + nx, nk = w.kind[q]; if (!(nk === T.PARK || ((nk === T.RES || nk === T.COM || nk === T.IND) && w.level[q]))) continue;
      const r = hash(x * 4 + s, y, 61), side = (hash(x, y * 4 + s, 62) - 0.5) * 0.5;
      const px = dx * 0.4 + (dy ? side : 0), py = dy * 0.4 + (dx ? side : 0), PX = cxT + (px - py) * 32 * z, PY = cyT + (px + py) * 16 * z;
      if (nk === T.RES && r < 0.55) {
        const sp = mip(treeSprite([1, 4, 1, 2][Math.floor(r * 40) % 4], mode), lvl);
        if (sp) { const sc = 0.62; ctx.drawImage(sp.c, PX - sp.ox * z * sc, PY - sp.oy * z * sc, (sp.c.width / sp.S) * z * sc, (sp.c.height / sp.S) * z * sc); }
      } else if ((nk === T.COM || nk === T.IND) && r < 0.5) {
        const pc = this.parkedSprite(Math.floor(r * 50) % 6, dx !== 0 ? 1 : 0, mode); const qx = dx * 0.34 + (dy ? side : 0), qy = dy * 0.34 + (dx ? side : 0);
        ctx.drawImage(pc, cxT + (qx - qy) * 32 * z - 9 * z, cyT + (qx + qy) * 16 * z - 9 * z, 18 * z, 13 * z);
      } else if (nk === T.PARK && r < 0.4) ctx.drawImage(this.benchSprite(mode), PX - 7 * z, PY - 7 * z, 14 * z, 10 * z);
    }
  }
  parkedSprite(col, axis, mode) {
    const key = col * 8 + axis * 4 + mode; this.parked = this.parked || new Map(); let c = this.parked.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = 36; c.height = 26; const x = c.getContext('2d'); x.scale(2, 2);
    const base = ['#d9534a', '#3d6fb0', '#f2f2f2', '#2c3440', '#e0b526', '#4f9a6a'][col], d = mode === 2 ? 0.55 : mode === 1 ? 0.85 : 1;
    const sh = (hx, f) => { const n = parseInt(hx.slice(1), 16); return `rgb(${(((n >> 16) & 255) * f * d) | 0},${(((n >> 8) & 255) * f * d) | 0},${((n & 255) * f * d) | 0})`; };
    const P = (u, v, h = 0) => [9 + (u - v) * 8, 6 + (u + v) * 4 - h];
    const L = axis ? 0.85 : 0.4, Wd = axis ? 0.4 : 0.85, u0 = -L / 2, v0 = -Wd / 2;
    const poly = (a, f) => { x.beginPath(); x.moveTo(a[0][0], a[0][1]); for (const p of a.slice(1)) x.lineTo(p[0], p[1]); x.closePath(); x.fillStyle = f; x.fill(); };
    x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(10, 7.5, 7, 3.2, 0, 0, 6.3); x.fill();
    const box = (a, b, c2, dd, h0, h1, f) => { poly([P(a, b + dd, h0), P(a + c2, b + dd, h0), P(a + c2, b + dd, h1), P(a, b + dd, h1)], sh(f, 1)); poly([P(a + c2, b, h0), P(a + c2, b + dd, h0), P(a + c2, b + dd, h1), P(a + c2, b, h1)], sh(f, 0.75)); poly([P(a, b, h1), P(a + c2, b, h1), P(a + c2, b + dd, h1), P(a, b + dd, h1)], sh(f, 1.12)); };
    box(u0, v0, L, Wd, 0.6, 2.6, base);
    box(u0 + (axis ? 0.2 : 0.06), v0 + (axis ? 0.06 : 0.2), axis ? L * 0.5 : L - 0.12, axis ? Wd - 0.12 : Wd * 0.5, 2.6, 4.4, base);
    poly([P(u0 + (axis ? 0.2 : 0.06), v0 + (axis ? 0.06 : 0.2) + (axis ? Wd - 0.12 : Wd * 0.5), 2.8), P(u0 + (axis ? 0.2 + L * 0.5 : L - 0.06), v0 + (axis ? 0.06 : 0.2) + (axis ? Wd - 0.12 : Wd * 0.5), 2.8), P(u0 + (axis ? 0.2 + L * 0.5 : L - 0.06), v0 + (axis ? 0.06 : 0.2) + (axis ? Wd - 0.12 : Wd * 0.5), 4.1), P(u0 + (axis ? 0.2 : 0.06), v0 + (axis ? 0.06 : 0.2) + (axis ? Wd - 0.12 : Wd * 0.5), 4.1)], mode === 2 ? 'rgb(40,52,80)' : 'rgb(120,160,190)');
    this.parked.set(key, c); return c;
  }
  benchSprite(mode) {
    this.bench = this.bench || []; if (this.bench[mode]) return this.bench[mode];
    const c = document.createElement('canvas'); c.width = 28; c.height = 20; const x = c.getContext('2d'); x.scale(2, 2);
    const d = mode === 2 ? 0.55 : mode === 1 ? 0.85 : 1, wood = `rgb(${(150 * d) | 0},${(102 * d) | 0},${(60 * d) | 0})`;
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(7.5, 7.5, 6, 2, 0, 0, 6.3); x.fill();
    x.strokeStyle = `rgb(${(60 * d) | 0},${(64 * d) | 0},${(72 * d) | 0})`; x.lineWidth = 0.8; x.beginPath(); x.moveTo(3, 7); x.lineTo(3, 4.5); x.moveTo(11, 7); x.lineTo(11, 4.5); x.stroke();
    x.fillStyle = wood; x.fillRect(2, 3.6, 10, 1.4); x.fillRect(2, 1.4, 10, 1.1);
    x.fillStyle = `rgb(${(70 * d) | 0},${(110 * d) | 0},${(70 * d) | 0})`; x.fillRect(12.4, 4, 1.4, 3);       // a bin
    return (this.bench[mode] = c);
  }
  // A wet road: a darker surface with pale streaks of sky reflected in it.
  wetSprite(mode) {
    this.wetS = this.wetS || []; if (this.wetS[mode]) return this.wetS[mode];
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
    x.beginPath(); x.moveTo(64, 0); x.lineTo(128, 32); x.lineTo(64, 64); x.lineTo(0, 32); x.closePath(); x.clip();
    x.fillStyle = mode === 2 ? 'rgba(10,16,30,.35)' : 'rgba(20,30,48,.28)'; x.fillRect(0, 0, 128, 64);
    const hi = mode === 2 ? 'rgba(255,214,150,.22)' : mode === 1 ? 'rgba(255,200,150,.25)' : 'rgba(210,228,245,.3)';
    for (let i = 0; i < 7; i++) { const yy = 8 + i * 8 + (i % 2) * 3, xx = 20 + ((i * 37) % 70); x.fillStyle = hi; x.beginPath(); x.ellipse(xx, yy, 14 + (i % 3) * 6, 1.4, 0, 0, 6.3); x.fill(); }
    return (this.wetS[mode] = c);
  }
  // Draw the vertical strips [k0, k1) of a picture (in half-tile columns from the anchor's corner, 32 units each).
  slices(ctx, sp, AX, AY, z, ranges) {
    const Wu = sp.c.width / sp.S, Hu = sp.c.height / sp.S;
    for (const [k0, k1] of ranges) {
      const u0 = Math.max(0, sp.ox + k0 * 32), u1 = Math.min(Wu, sp.ox + k1 * 32); if (u1 <= u0) continue;
      ctx.drawImage(sp.c, u0 * sp.S, 0, (u1 - u0) * sp.S, sp.c.height, AX + (u0 - sp.ox) * z, AY - sp.oy * z, (u1 - u0) * z, Hu * z);
    }
  }
  // A flag waving in the wind: three bands that ripple along the cloth. Smooth graphics draws it still.
  flag(ctx, X, Y, z, t, mode, col, still, ph) {
    const L = 11 * z, H = 7 * z, n = 6;
    const wv = (i) => (still ? 0 : Math.sin(t * 5 + ph * 6 + i * 1.1) * (i / n) * 1.6 * z);
    ctx.fillStyle = tint(col, mode); ctx.beginPath(); ctx.moveTo(X, Y);
    for (let i = 1; i <= n; i++) ctx.lineTo(X + (L * i) / n, Y + (3 * z * i) / n + wv(i));
    for (let i = n; i >= 0; i--) ctx.lineTo(X + (L * i) / n, Y + H - (1.5 * z * i) / n + wv(i));
    ctx.closePath(); ctx.fill();
  }
  // Gulls circling over harbors, piers, beaches and marinas (where boats and people are), with their shadows on the water.
  gulls(ctx, g, z, cx, cy, t, mode) {
    if (!this.gullT || t - this.gullT > 5) {                  // where they gather is looked up every few seconds, not every frame
      this.gullT = t; const spots = [];
      for (const h of g.ships.harbors.values()) spots.push(h.dock);
      const w = g.world; for (let i = 0; i < N * N && spots.length < 24; i++) if (w.kind[i] === T.SVC && w.bo[i] === 0 && (w.bt[i] === 23 || w.bt[i] === 24 || w.bt[i] === 16)) spots.push(w.bt[i] === 16 ? i + N + 1 : i);
      this.gullSpots = spots;
    }
    const col = mode === 2 ? 'rgba(220,225,235,.8)' : '#f7f7f2';
    for (let s = 0; s < this.gullSpots.length; s++) {
      const q = this.gullSpots[s], qx = q % N + 0.5, qy = ((q / N) | 0) + 0.5;
      for (let j = 0; j < 3; j++) {
        const ph = hash(q, j, 5) * 6.28, r = 0.9 + hash(q, j, 6) * 1.4, sp = (0.25 + hash(q, j, 7) * 0.2) * (j % 2 ? 1 : -1), a = t * sp + ph;
        const bx = qx + Math.cos(a) * r, by = qy + Math.sin(a) * r * 0.8, hgt = 34 + hash(q, j, 8) * 18 + Math.sin(t * 0.7 + ph) * 4;
        const X = (bx - by) * 32 * z + cx, Y = (bx + by) * 16 * z + cy;
        if (X < -20 || X > this.W + 20 || Y < -60 || Y > this.H + 20) continue;
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.ellipse(X, Y, 2.6 * z, 1 * z, 0, 0, 6.3); ctx.fill();
        const flap = Math.sin(t * 9 + ph * 3) > 0.6 ? 2.4 : 0.6, yy = Y - hgt * z;   // mostly gliding, a few wingbeats
        ctx.strokeStyle = col; ctx.lineWidth = 1.1 * z; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(X - 4.5 * z, yy - flap * z); ctx.quadraticCurveTo(X - 2 * z, yy - 1.6 * z, X, yy); ctx.quadraticCurveTo(X + 2 * z, yy - 1.6 * z, X + 4.5 * z, yy - flap * z); ctx.stroke();
      }
    }
  }
  birds(ctx, g, z, cx, cy, t, mode) {
    for (const f of g.ambient.birds) {
      for (let k = 0; k < f.n; k++) {
        const row = Math.ceil(k / 2) * (k % 2 ? 1 : -1), bx = f.x - f.vx * 0.12 * Math.abs(row) + f.vy * 0.1 * row, by = f.y - f.vy * 0.12 * Math.abs(row) - f.vx * 0.1 * row;
        const X = (bx - by) * 32 * z + cx, Y = (bx + by) * 16 * z + cy - (f.h + Math.sin(t + k) * 3) * z, fl = Math.sin(t * 11 + k * 1.7 + f.seed) * 3.2 * z;
        ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.ellipse(X, Y + f.h * z, 3 * z, 1.2 * z, 0, 0, 6.3); ctx.fill();
        ctx.strokeStyle = mode === 2 ? '#aab' : '#2b2e36'; ctx.lineWidth = 1.2 * z; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X - 5 * z, Y - fl); ctx.lineTo(X, Y); ctx.lineTo(X + 5 * z, Y - fl); ctx.stroke();
      }
    }
  }
  clouds(ctx, g, z, cx, cy, t, mode) {
    const k = g.ambient.weather.k, a = (mode === 0 ? 0.075 : mode === 1 ? 0.06 : 0.03) + k * 0.05;
    ctx.save(); ctx.fillStyle = `rgba(8,22,40,${a})`;
    for (let i = 0; i < 6; i++) {
      const wx = (((i * 37 + t * 0.32) % (N + 40)) - 20), wy = (i * 29.7 + Math.sin(i) * 8) % N, X = (wx - wy) * 32 * z + cx, Y = (wx + wy) * 16 * z + cy;
      ctx.beginPath(); ctx.ellipse(X, Y, (170 + i * 26) * z, (66 + i * 8) * z, 0, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }
  neon(ctx, list, z, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cols = ['255,79,163', '79,209,255', '255,210,79', '120,255,160'];
    for (const [X, Y, lv, x, y] of list) {
      const c = cols[(x * 3 + y) % 4], fl = 0.7 + 0.3 * Math.sin(t * 3.1 + x * 1.7 + y), hh = [20, 36, 60, 84][lv - 1] * z, r = (13 + lv * 4) * z;
      const gl = ctx.createRadialGradient(X + 8 * z, Y - hh * 0.4 + 8 * z, 0, X + 8 * z, Y - hh * 0.4 + 8 * z, r); gl.addColorStop(0, `rgba(${c},${0.42 * fl})`); gl.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gl; ctx.fillRect(X + 8 * z - r, Y - hh * 0.4 + 8 * z - r, r * 2, r * 2);
    }
    ctx.restore();
  }
  weather(ctx, g, t, mode) {
    const wt = g.ambient.weather, k = wt.k, W = this.W, H = this.H;
    if (k > 0.01) {
      ctx.fillStyle = `rgba(28,40,62,${0.24 * k})`; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(196,214,238,${0.4 * k})`; ctx.lineWidth = 1; ctx.beginPath();
      const n = Math.floor(this.rain.length * Math.min(1, k * 1.2));
      for (let i = 0; i < n; i++) { const d = this.rain[i], x = ((d.x * W + t * 40 * d.v) % (W + 40)) - 10, y = ((d.y + t * 1.35 * d.v) % 1) * H; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 13 * d.v); }
      ctx.stroke();
    }
    if (wt.flash > 0.02) { ctx.fillStyle = `rgba(235,240,255,${0.42 * wt.flash})`; ctx.fillRect(0, 0, W, H); }
  }
  vignette(ctx, mode) {
    const W = this.W, H = this.H, a = mode === 2 ? 0.42 : mode === 1 ? 0.28 : 0.15;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,12,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  manhole(ctx, X, Y, z, mode) {
    const cx = X, cy = Y + 16 * z, d = mode === 2 ? 0.55 : 1;
    ctx.fillStyle = `rgba(${60 * d | 0},${66 * d | 0},${76 * d | 0},.95)`; ctx.beginPath(); ctx.ellipse(cx, cy, 4.2 * z, 2.1 * z, 0, 0, 6.3); ctx.fill();
    ctx.strokeStyle = `rgba(${160 * d | 0},${168 * d | 0},${180 * d | 0},.9)`; ctx.lineWidth = 0.8 * z; ctx.beginPath(); ctx.ellipse(cx, cy, 4.2 * z, 2.1 * z, 0, 0, 6.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 2.6 * z, cy); ctx.lineTo(cx + 2.6 * z, cy); ctx.moveTo(cx, cy - 1.2 * z); ctx.lineTo(cx, cy + 1.2 * z); ctx.stroke();
  }
  fire(ctx, f, X, Y, z, t, mode, hb) {
    const cx = X, cy = Y + 16 * z, n = 3 + Math.min(5, Math.floor(f.dmg / 4)), dim = mode === 2 ? 1 : 0.9;
    ctx.save();
    for (let k = 0; k < n; k++) {
      const h1 = ((Math.sin(f.ph * 7 + k * 12.9) * 43758.5) % 1 + 1) % 1, h2 = ((Math.sin(f.ph * 3 + k * 78.2) * 24634.6) % 1 + 1) % 1, h3 = ((Math.sin(f.ph * 5 + k * 31.7) * 9871.3) % 1 + 1) % 1;
      const x = cx + (h1 - 0.5) * 36 * z, y = cy + (h2 - 0.5) * 14 * z - h3 * hb * 0.75 * z, fl = Math.sin(t * 9 + f.ph + k * 1.7), w = (4.5 + h1 * 3) * z, hgt = (11 + h3 * 6 + fl * 3) * z;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y - hgt * 0.4, 0, x, y - hgt * 0.4, hgt * 1.6); g.addColorStop(0, 'rgba(255,140,40,.35)'); g.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = g; ctx.fillRect(x - hgt * 1.6, y - hgt * 2, hgt * 3.2, hgt * 3.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 1.1, y - hgt * 0.6, x + fl * z, y - hgt); ctx.quadraticCurveTo(x + w * 1.1, y - hgt * 0.6, x + w, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffc93a'; ctx.beginPath(); ctx.moveTo(x - w * 0.55, y); ctx.quadraticCurveTo(x - w * 0.6, y - hgt * 0.45, x + fl * 0.5 * z, y - hgt * 0.72); ctx.quadraticCurveTo(x + w * 0.6, y - hgt * 0.45, x + w * 0.55, y); ctx.closePath(); ctx.fill();
    }
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.5 + k / 3 + f.ph) % 1;
      ctx.fillStyle = `rgba(40,40,46,${(1 - ph) * 0.42 * dim})`; ctx.beginPath(); ctx.arc(cx + ph * 12 * z + Math.sin(ph * 6 + k) * 3 * z, cy - hb * 0.8 * z - ph * 34 * z, (4 + ph * 9) * z, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }
  rubble(ctx, i, X, Y, z, left, mode) {
    const a = Math.min(1, left / 6), cx = X, cy = Y + 16 * z, d = mode === 2 ? 0.5 : 1;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = `rgba(${90 * d | 0},${78 * d | 0},${66 * d | 0},.85)`; ctx.beginPath(); ctx.moveTo(cx, cy - 11 * z); ctx.lineTo(cx + 24 * z, cy); ctx.lineTo(cx, cy + 11 * z); ctx.lineTo(cx - 24 * z, cy); ctx.closePath(); ctx.fill();
    const cols = ['#8b7d6b', '#6e6355', '#b0a08a', '#a05a3c', '#5b5248'];
    for (let k = 0; k < 11; k++) {
      const h1 = ((Math.sin(i * 12.9 + k * 78.2) * 43758.5) % 1 + 1) % 1, h2 = ((Math.sin(i * 4.1 + k * 31.7) * 24634.6) % 1 + 1) % 1;
      const x = cx + (h1 - 0.5) * 38 * z, y = cy + (h2 - 0.5) * 16 * z, w = (2.5 + h1 * 4) * z, hh = (1.6 + h2 * 3.5) * z;
      ctx.fillStyle = cols[k % 5]; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * 0.4, y - hh); ctx.lineTo(x + w, y - hh * 0.6); ctx.lineTo(x + w * 0.7, y + hh * 0.3); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#4a3f33'; ctx.lineWidth = 1.2 * z; for (let k = 0; k < 3; k++) { const x = cx + (k - 1) * 9 * z; ctx.beginPath(); ctx.moveTo(x, cy + 2 * z); ctx.lineTo(x + (k - 1) * 5 * z, cy - 8 * z); ctx.stroke(); }
    ctx.restore();
  }
  tornado(ctx, t0, z, cx, cy, t, mode) {
    const bx = (t0.x - t0.y) * 32 * z + cx, by = (t0.x + t0.y) * 16 * z + cy + 16 * z, H = 120 * z, d = mode === 2 ? 0.55 : 1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(bx, by + 2 * z, 26 * z, 11 * z, 0, 0, 6.3); ctx.fill();
    for (let k = 0; k <= 16; k++) {
      const u = k / 16, y = by - u * H, rx = (5 + 30 * u * u) * z + Math.sin(t * 3 + k) * 1.5 * z, ox = Math.sin(t * 1.3 + u * 3.2) * 10 * u * z;
      const sh = (80 + 40 * ((k + Math.floor(t * 10)) % 2)) * d | 0;
      ctx.fillStyle = `rgba(${sh},${sh + 4},${sh + 12},${0.62 - 0.12 * u})`; ctx.beginPath(); ctx.ellipse(bx + ox, y, rx, rx * 0.34, 0, 0, 6.3); ctx.fill();
    }
    for (let k = 0; k < 5; k++) { ctx.fillStyle = `rgba(${52 * d | 0},${56 * d | 0},${64 * d | 0},.88)`; ctx.beginPath(); ctx.ellipse(bx + Math.sin(t + k * 1.9) * 16 * z, by - H - 4 * z + k * 2 * z, (34 - k * 3) * z, (11 - k) * z, 0, 0, 6.3); ctx.fill(); }
    for (let k = 0; k < 20; k++) {
      const a = t * (3 + (k % 4)) + k * 1.3, u = ((k * 0.137 + t * 0.2) % 1), r = (7 + u * 28) * z, y = by - u * H * 0.9;
      ctx.fillStyle = k % 3 ? `rgba(${70 * d | 0},${58 * d | 0},${44 * d | 0},.95)` : `rgba(${150 * d | 0},${130 * d | 0},${100 * d | 0},.95)`;
      ctx.fillRect(bx + Math.cos(a) * r - z, y + Math.sin(a) * r * 0.34 - z, (2 + (k % 3)) * z, (1.4 + (k % 2)) * z);
    }
    ctx.fillStyle = 'rgba(190,170,140,.38)'; for (let k = 0; k < 5; k++) { const a = t * 2 + k * 1.26; ctx.beginPath(); ctx.ellipse(bx + Math.cos(a) * 22 * z, by + Math.sin(a) * 8 * z, 9 * z, 4 * z, 0, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }
  ufo(ctx, u, z, cx, cy, t, mode) {
    const bx = (u.x - u.y) * 32 * z + cx, by = (u.x + u.y) * 16 * z + cy + 16 * z, sy = by - u.h * z, d = mode === 2 ? 0.7 : 1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(bx, by, 24 * z, 9 * z, 0, 0, 6.3); ctx.fill();
    if (u.beam) {
      const tx = (u.beam.i % N - (u.beam.i / N | 0)) * 32 * z + cx, ty = ((u.beam.i % N) + (u.beam.i / N | 0)) * 16 * z + cy + 16 * z, k = Math.min(1, u.beam.t / 1.3), fl = 0.5 + 0.5 * Math.sin(t * 24);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, sy, 0, ty); g.addColorStop(0, `rgba(150,255,170,${0.5 + 0.2 * fl})`); g.addColorStop(1, `rgba(90,255,150,${0.16 + 0.3 * k})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - 9 * z, sy + 4 * z); ctx.lineTo(bx + 9 * z, sy + 4 * z); ctx.lineTo(tx + (14 + 6 * k) * z, ty + 4 * z); ctx.lineTo(tx - (14 + 6 * k) * z, ty + 4 * z); ctx.closePath(); ctx.fill();
      const gl = ctx.createRadialGradient(tx, ty, 0, tx, ty, (30 + 20 * k) * z); gl.addColorStop(0, `rgba(160,255,190,${0.35 + 0.4 * k})`); gl.addColorStop(1, 'rgba(160,255,190,0)'); ctx.fillStyle = gl; ctx.fillRect(tx - 60 * z, ty - 40 * z, 120 * z, 80 * z);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = `rgb(${96 * d | 0},${104 * d | 0},${118 * d | 0})`; ctx.beginPath(); ctx.ellipse(bx, sy + 3 * z, 22 * z, 7 * z, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = `rgb(${150 * d | 0},${160 * d | 0},${176 * d | 0})`; ctx.beginPath(); ctx.ellipse(bx, sy, 22 * z, 7 * z, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = `rgba(${120 * d | 0},${230 * d | 0},${255 * d | 0},.8)`; ctx.beginPath(); ctx.ellipse(bx, sy - 3 * z, 9 * z, 8 * z, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = `rgb(${190 * d | 0},${200 * d | 0},${215 * d | 0})`; ctx.beginPath(); ctx.ellipse(bx, sy - 1 * z, 22 * z, 6 * z, 0, 0, Math.PI); ctx.fill();
    for (let k = 0; k < 7; k++) { const a = u.spin * 3 + k * 0.9, lx = bx + Math.cos(a) * 17 * z, ly = sy + 1.5 * z + Math.sin(a) * 4.5 * z; if (Math.sin(a) < -0.2) continue; ctx.fillStyle = ['#ffd34d', '#ff6a6a', '#7dffa0', '#79c0ff'][k % 4]; ctx.beginPath(); ctx.arc(lx, ly, 1.6 * z, 0, 6.3); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createRadialGradient(bx, sy, 0, bx, sy, 36 * z); g2.addColorStop(0, 'rgba(140,255,200,.28)'); g2.addColorStop(1, 'rgba(140,255,200,0)'); ctx.fillStyle = g2; ctx.fillRect(bx - 40 * z, sy - 40 * z, 80 * z, 80 * z);
    ctx.restore();
  }
  pole(ctx, w, x, y, X, Y, z, mode) {
    const bx = X, by = Y + 16 * z, H = 26 * z, tx = bx, ty = by - H;
    ctx.lineCap = 'round';
    ctx.strokeStyle = mode === 2 ? '#2a2118' : '#6b5844'; ctx.lineWidth = 2.2 * z; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.lineWidth = 1.6 * z; ctx.beginPath(); ctx.moveTo(tx - 6 * z, ty + 2.5 * z); ctx.lineTo(tx + 6 * z, ty - 2.5 * z); ctx.stroke();
    ctx.fillStyle = mode === 2 ? '#4a4f5a' : '#dfe3e8'; ctx.beginPath(); ctx.arc(tx - 6 * z, ty + 2.5 * z, 1.1 * z, 0, 6.3); ctx.arc(tx + 6 * z, ty - 2.5 * z, 1.1 * z, 0, 6.3); ctx.fill();
    ctx.strokeStyle = mode === 2 ? '#0e1016' : '#2b2e36'; ctx.lineWidth = 0.9 * z;
    const link = (nx, ny, dx, dy) => {
      if (!w.inb(nx, ny) || w.wire[ny * N + nx] !== 1) return;
      const ex = tx + dx * 32 * z, ey = ty + dy * 16 * z, mx = (tx + ex) / 2, my = (ty + ey) / 2 + 5 * z;
      for (const o of [-1, 1]) { ctx.beginPath(); ctx.moveTo(tx + o * 5 * z, ty - o * 2 * z); ctx.quadraticCurveTo(mx + o * 5 * z, my - o * 2 * z, ex + o * 5 * z, ey - o * 2 * z); ctx.stroke(); }
    };
    link(x + 1, y, 1, 1); link(x, y + 1, -1, 1);
  }
  truck(ctx, c, z, cx, cy, mode, now) {
    const P = (x, y, h = 0) => [(x - y) * 32 * z + cx, (x + y) * 16 * z + cy - h * z];
    const d = mode === 2 ? 0.45 : mode === 1 ? 0.85 : 1;
    const sh = (hex, f) => { const h = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, ((h >> 16) & 255) * f * d) | 0},${Math.min(255, ((h >> 8) & 255) * f * d) | 0},${Math.min(255, (h & 255) * f * d) | 0})`; };
    const poly = (a, f) => { ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) ctx.lineTo(a[i][0], a[i][1]); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); };
    const boxAt = (px, py, l, wd, z0, z1, col) => {
      const horiz = c.dx !== 0, bw = horiz ? l : wd, bd = horiz ? wd : l, x = px - bw / 2, y = py - bd / 2;
      poly([P(x, y + bd, z0), P(x + bw, y + bd, z0), P(x + bw, y + bd, z1), P(x, y + bd, z1)], sh(col, 1));
      poly([P(x + bw, y, z0), P(x + bw, y + bd, z0), P(x + bw, y + bd, z1), P(x + bw, y, z1)], sh(col, 0.76));
      poly([P(x, y, z1), P(x + bw, y, z1), P(x + bw, y + bd, z1), P(x, y + bd, z1)], sh(col, 1.1));
    };
    const fx = c.dx > 0 || c.dy > 0 ? 1 : -1;      // screen-order: draw the part behind first
    const parts = [[c.px - c.dx * 0.07, c.py - c.dy * 0.07, 0.3, 0.17, 1, 8, c.fire ? '#cf3a2e' : '#3f8f5a'], [c.px + c.dx * 0.18, c.py + c.dy * 0.18, 0.14, 0.17, 1, 6, '#f1f1ee']];
    for (const q of (fx > 0 ? parts : parts.slice().reverse())) boxAt(...q.slice(0, 4), q[4], q[5], q[6]);
    if (c.fire) {
      const on = Math.floor(now * 6) % 2, p = P(c.px + c.dx * 0.16, c.py + c.dy * 0.16, 8);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [o, col] of [[-3, on ? 'rgba(255,50,40,.9)' : 'rgba(255,50,40,.15)'], [3, on ? 'rgba(60,120,255,.15)' : 'rgba(60,120,255,.9)']]) { const g2 = ctx.createRadialGradient(p[0] + o * z, p[1], 0, p[0] + o * z, p[1], 9 * z); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(p[0] + o * z - 9 * z, p[1] - 9 * z, 18 * z, 18 * z); }
      ctx.restore();
    }
    if (mode === 2 || (mode === 1 && ctx.gpu)) this.headlights(ctx, c, z, cx, cy, mode, 0.32);
  }
  blades(ctx, X, Y, z, t, mode) {
    const a0 = t * 1.8, L = 25 * z;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i * 2 * Math.PI) / 3, ex = X + Math.cos(a) * L, ey = Y + Math.sin(a) * L * 0.9;
      ctx.strokeStyle = mode === 2 ? '#7b8296' : '#f4f6f8'; ctx.lineWidth = 2.6 * z; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.fillStyle = mode === 2 ? '#7b8296' : '#cfd4da'; ctx.beginPath(); ctx.arc(X, Y, 3 * z, 0, 6.3); ctx.fill();
  }
  badge(ctx, X, Y, z, type) {
    if (z < 0.6) return;
    this.badgeC = this.badgeC || {}; let c = this.badgeC[type];
    if (!c) { c = this.badgeC[type] = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.scale(2, 2); this.badgeShape(x, 16, 16, 1, type); }   // drawn once, then copied
    ctx.drawImage(c, X - 16 * z, Y - 16 * z, 32 * z, 32 * z);
  }
  badgeShape(ctx, X, Y, z, type) {
    const r = 8 * z;
    ctx.fillStyle = type === 'bolt' ? '#ef6f5e' : type === 'trash' ? '#a0703c' : type === 'closed' ? '#6b7280' : '#3d8bd9'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 * z;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    if (type === 'bolt') { ctx.moveTo(X + 1.5 * z, Y - 5 * z); ctx.lineTo(X - 3 * z, Y + 1 * z); ctx.lineTo(X, Y + 1 * z); ctx.lineTo(X - 1.5 * z, Y + 5 * z); ctx.lineTo(X + 3 * z, Y - 1.2 * z); ctx.lineTo(X + 0.2 * z, Y - 1.2 * z); ctx.closePath(); }
    else if (type === 'closed') { ctx.rect(X - 4 * z, Y - 1 * z, 8 * z, 6 * z); ctx.fill(); ctx.beginPath(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 * z; ctx.arc(X, Y - 1.5 * z, 2.6 * z, Math.PI, 0); ctx.stroke(); return; }
    else if (type === 'trash') { ctx.rect(X - 3 * z, Y - 2 * z, 6 * z, 7 * z); ctx.rect(X - 4 * z, Y - 4 * z, 8 * z, 1.6 * z); ctx.rect(X - 1.5 * z, Y - 5.6 * z, 3 * z, 1.4 * z); }
    else { ctx.moveTo(X, Y - 5 * z); ctx.quadraticCurveTo(X + 5 * z, Y + 1 * z, X, Y + 5 * z); ctx.quadraticCurveTo(X - 5 * z, Y + 1 * z, X, Y - 5 * z); }
    ctx.fill();
  }
  selection(ctx, s, z, cx, cy, t) {
    const P = (x, y) => [(x - y) * 32 * z + cx, (x + y) * 16 * z + cy];
    const a = P(s.x, s.y), b = P(s.x + s.w, s.y), c = P(s.x + s.w, s.y + s.d), d = P(s.x, s.y + s.d);
    ctx.save(); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    ctx.fillStyle = 'rgba(242,184,75,.18)'; ctx.fill();
    ctx.setLineDash([6 * z, 4 * z]); ctx.lineDashOffset = -t * 18 * z; ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2.2 * z; ctx.stroke(); ctx.restore();
  }
  highwaySign(ctx, X, Y, z, mode) {
    if (z < 0.4) return;
    const dim = mode === 2 ? 0.55 : mode === 1 ? 0.85 : 1, bx = X + 18 * z, by = Y + 16 * z;
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1.6 * z;
    ctx.beginPath(); ctx.moveTo(bx - 9 * z, by); ctx.lineTo(bx - 9 * z, by - 30 * z); ctx.moveTo(bx + 9 * z, by); ctx.lineTo(bx + 9 * z, by - 30 * z); ctx.stroke();
    ctx.fillStyle = `rgb(${(31 * dim) | 0},${(122 * dim) | 0},${(74 * dim) | 0})`; ctx.fillRect(bx - 15 * z, by - 42 * z, 30 * z, 15 * z);
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.8 * z; ctx.strokeRect(bx - 13.5 * z, by - 40.5 * z, 27 * z, 12 * z);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${6.5 * z}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('REGION', bx, by - 34.5 * z); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  overlay(ctx, g, z, cx, cy) {
    const w = g.world, sim = g.sim, ov = g.overlay, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(8,16,30,.4)'; ctx.fillRect(0, 0, W, H);
    const ramp = (v, a) => `hsla(${Math.round(120 * Math.max(0, Math.min(1, v)))},78%,50%,${a})`;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const X = (x - y) * 32 * z + cx, Y = (x + y) * 16 * z + cy;
      if (X < -40 * z || X > W + 40 * z || Y < -34 * z || Y > H) continue;
      const i = y * N + x; let col = null;
      if (w.terrain[i] === TERRAIN.WATER) continue;
      switch (ov) {
        case 'value': col = ramp((sim.lv[i] - 25) / 65, 0.6); break;
        case 'commute': {
          const k = w.kind[i];
          if (k === T.ROAD) col = sim.roadComp[i] >= 0 && sim.hwRoadComp && sim.hwRoadComp.has(sim.roadComp[i]) ? 'rgba(120,170,255,.55)' : 'rgba(160,170,185,.5)';
          else if (k === T.RES || k === T.COM || k === T.IND) {
            const ok = sim.hwNet[i] && (k === T.RES ? sim.jobReach[i] : sim.workReach[i]);
            col = !sim.hwNet[i] ? 'rgba(160,170,185,.75)' : ok ? 'rgba(95,211,166,.72)' : 'rgba(239,111,94,.8)';
          }
          break;
        }
        case 'crime': col = ramp(1 - sim.crime[i] / 70, 0.6); break;
        case 'pollution': if (sim.poll[i] > 2) col = ramp(1 - sim.poll[i] / 60, 0.62); break;
        case 'police': if (sim.cov.police[i] > 0.02) col = `rgba(80,140,255,${0.2 + sim.cov.police[i] * 0.5})`; break;
        case 'fire': if (sim.cov.fire[i] > 0.02) col = `rgba(255,110,70,${0.2 + sim.cov.fire[i] * 0.5})`; break;
        case 'health': if (sim.cov.health[i] > 0.02) col = `rgba(255,120,170,${0.2 + sim.cov.health[i] * 0.5})`; break;
        case 'traffic': if (w.kind[i] === T.ROAD) col = ramp(1 - Math.min(1, sim.flowM.load[i] / 1.4), 0.75); break;
        case 'transit': if (sim.cov.transit[i] > 0.02) col = `rgba(70,200,190,${0.2 + sim.cov.transit[i] * 0.5})`; break;
        case 'metro': if (sim.cov.metro[i] > 0.02) col = `rgba(220,70,60,${0.2 + sim.cov.metro[i] * 0.5})`; break;
        case 'fun': if (sim.cov.fun[i] > 0.02) col = `rgba(190,120,255,${0.2 + sim.cov.fun[i] * 0.5})`; break;
        case 'waste': { const m = sim.wasteMap[i]; col = m === 3 ? 'rgba(95,211,166,.7)' : m === 2 ? 'rgba(239,111,94,.8)' : m === 1 ? 'rgba(176,132,76,.38)' : null; break; }
        case 'edu': if (sim.cov.edu[i] > 0.02) col = `rgba(240,200,70,${0.2 + sim.cov.edu[i] * 0.5})`; break;
        case 'power': { const m = sim.powerMap[i]; col = m === 1 ? 'rgba(95,211,166,.7)' : m === 2 ? 'rgba(239,111,94,.8)' : m === 3 && w.wire[i] ? 'rgba(242,184,75,.55)' : m === 4 ? 'rgba(160,170,185,.5)' : null; break; }
        case 'water': { const m = sim.waterMap[i]; col = m === 3 ? 'rgba(95,211,166,.7)' : m === 2 ? 'rgba(239,111,94,.8)' : m === 4 ? 'rgba(80,190,255,.45)' : m === 5 ? 'rgba(160,170,185,.45)' : null; break; }
      }
      if (!col) continue;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + 32 * z, Y + 16 * z); ctx.lineTo(X, Y + 32 * z); ctx.lineTo(X - 32 * z, Y + 16 * z); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
    if (ov === 'water') {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x; if (!w.pipe[i]) continue;
        const X = (x - y) * 32 * z + cx, Y = (x + y) * 16 * z + cy + 16 * z;
        if (X < -40 * z || X > W + 40 * z || Y < -34 * z || Y > H + 40 * z) continue;
        const live = sim.waterMap[i] === 4 || sim.waterMap[i] === 3; ctx.strokeStyle = live ? '#5cc8ff' : '#8a93a3'; ctx.lineWidth = 2.6 * z;
        ctx.beginPath();
        if (x + 1 < N && w.pipe[i + 1]) { ctx.moveTo(X, Y); ctx.lineTo(X + 32 * z, Y + 16 * z); }
        if (y + 1 < N && w.pipe[i + N]) { ctx.moveTo(X, Y); ctx.lineTo(X - 32 * z, Y + 16 * z); }
        ctx.stroke(); ctx.fillStyle = live ? '#5cc8ff' : '#8a93a3'; ctx.beginPath(); ctx.arc(X, Y, 3 * z, 0, 6.3); ctx.fill();
      }
    }
    if (ov === 'power') {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, wv = w.wire[i]; if (!wv) continue;
        const X = (x - y) * 32 * z + cx, Y = (x + y) * 16 * z + cy + 16 * z;
        if (X < -40 * z || X > W + 40 * z || Y < -34 * z || Y > H + 40 * z) continue;
        const live = sim.powerMap[i] === 3; ctx.strokeStyle = live ? '#ffd166' : '#8a93a3'; ctx.lineWidth = 2 * z; ctx.setLineDash(wv === 2 ? [4 * z, 3 * z] : []);
        ctx.beginPath();
        if (x + 1 < N && w.wire[i + 1]) { ctx.moveTo(X, Y); ctx.lineTo(X + 32 * z, Y + 16 * z); }
        if (y + 1 < N && w.wire[i + N]) { ctx.moveTo(X, Y); ctx.lineTo(X - 32 * z, Y + 16 * z); }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = live ? '#ffd166' : '#8a93a3'; ctx.beginPath(); ctx.arc(X, Y, (wv === 2 ? 2.2 : 3) * z, 0, 6.3); ctx.fill();
      }
    }
  }
  drawSlab(ctx, z, cx, cy, mode) {
    const P = (x, y, h = 0) => [(x - y) * 32 * z + cx, (x + y) * 16 * z + cy - h * z];
    const tn = (c) => (mode === 2 ? '#0b1630' : c);
    const quad = (a, f) => { ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) ctx.lineTo(a[i][0], a[i][1]); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); };
    const dim = mode === 2 ? 0.35 : mode === 1 ? 0.8 : 1;
    const col = (r, g, b) => `rgb(${(r * dim) | 0},${(g * dim) | 0},${(b * dim) | 0})`;
    quad([P(0, N), P(N, N), P(N, N, -3), P(0, N, -3)], col(94, 157, 72));
    quad([P(N, 0), P(N, N), P(N, N, -3), P(N, 0, -3)], col(77, 134, 57));
    quad([P(0, N, -3), P(N, N, -3), P(N, N, -18), P(0, N, -18)], col(139, 107, 75));
    quad([P(N, 0, -3), P(N, N, -3), P(N, N, -18), P(N, 0, -18)], col(108, 81, 57));
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.beginPath();
    let a = P(0, N, -10), b = P(N, N, -10); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    a = P(N, 0, -10); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  // ---------- water and ground ----------
  // For each water tile: which sides touch land (bit 1 = north-east, 2 = south-east, 4 = south-west, 8 = north-west),
  // and every tile's distance from land, which sets the water color. Terrain doesn't change once a city exists.
  shoreMask(w) {
    const m = this.shore = new Uint8Array(N * N), d = this.dist = new Float32Array(N * N), R2 = Math.SQRT2;
    const land = (xx, yy) => xx >= 0 && yy >= 0 && xx < N && yy < N && w.terrain[yy * N + xx] !== TERRAIN.WATER;
    for (let i = 0; i < N * N; i++) d[i] = w.terrain[i] === TERRAIN.WATER ? 1e9 : 0;
    const relax = (i, xx, yy, c) => { if (xx >= 0 && yy >= 0 && xx < N && yy < N) { const v = d[yy * N + xx] + c; if (v < d[i]) d[i] = v; } };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (d[i]) { relax(i, x - 1, y, 1); relax(i, x, y - 1, 1); relax(i, x - 1, y - 1, R2); relax(i, x + 1, y - 1, R2); } }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const i = y * N + x; if (d[i]) { relax(i, x + 1, y, 1); relax(i, x, y + 1, 1); relax(i, x + 1, y + 1, R2); relax(i, x - 1, y + 1, R2); } }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; d[i] = Math.min(20, d[i]);
      m[i] = w.terrain[i] !== TERRAIN.WATER ? 0 : (land(x, y - 1) ? 1 : 0) | (land(x + 1, y) ? 2 : 0) | (land(x, y + 1) ? 4 : 0) | (land(x - 1, y) ? 8 : 0);
    }
    // bounding boxes of each body of water, so the water layers only cover where there is water
    const seen = new Uint8Array(N * N), regions = [], stack = [];
    for (let i0 = 0; i0 < N * N; i0++) {
      if (seen[i0] || w.terrain[i0] !== TERRAIN.WATER) continue;
      let x0 = N, y0 = N, x1 = 0, y1 = 0; seen[i0] = 1; stack.push(i0);
      while (stack.length) {
        const i = stack.pop(), x = i % N, y = (i / N) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const q of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1]) if (q >= 0 && !seen[q] && w.terrain[q] === TERRAIN.WATER) { seen[q] = 1; stack.push(q); }
      }
      regions.push([x0, y0, x1 + 1, y1 + 1]);
    }
    for (let merged = true; merged;) {                     // join boxes that overlap, so nothing is drawn twice
      merged = false;
      for (let i = 0; i < regions.length && !merged; i++) for (let j = i + 1; j < regions.length; j++) {
        const A = regions[i], B = regions[j];
        if (A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3]) { regions[i] = [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[2], B[2]), Math.max(A[3], B[3])]; regions.splice(j, 1); merged = true; break; }
      }
    }
    this.waterRegions = regions;
    this.shoreFor = w; this.wtex = []; this.wJob = null; this.gFor = null;
  }
  // The whole sea as one smooth image in tile space: color follows distance from the shore, with soft variation,
  // so it reads as one body of water instead of a grid of tiles. Made once per lighting mode.
  // Built a slice at a time over a few frames (all at once only when there is nothing to show yet).
  waterTex(mode) {
    if (this.wtex[mode]) return this.wtex[mode];
    const prev = this.wtex.find(Boolean);
    if (!this.wJob || this.wJob.mode !== mode) this.wJob = this.waterJob(mode);
    const job = this.wJob, S = N * WQ, rows = prev ? 96 : S;
    job.run(Math.min(S, job.v + rows));
    if (job.v < S) return prev;
    this.wJob = null;
    return (this.wtex[mode] = job.done());
  }
  waterJob(mode) {
    const S = N * WQ, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), img = x.createImageData(S, S), px = img.data, D = this.dist;
    const stops = WATER_RAMP.map(([at, h]) => { const v = parseInt(tint(h, mode).slice(1), 16); return [at, (v >> 16) & 255, (v >> 8) & 255, v & 255]; });
    const lattice = (step, seed) => { const n = Math.ceil((N + 2) / step) + 2, a = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) a[j * n + i] = hash(i, j, seed); return { a, n, step }; };
    const noise = (L, fx, fy) => {
      const gx = (fx + 1) / L.step, gy = (fy + 1) / L.step, ix = Math.floor(gx), iy = Math.floor(gy), tx = gx - ix, ty = gy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), a = L.a, i0 = iy * L.n + ix, i1 = i0 + L.n;
      const top = a[i0] + (a[i0 + 1] - a[i0]) * sx, bot = a[i1] + (a[i1 + 1] - a[i1]) * sx;
      return top + (bot - top) * sy;
    };
    const L1 = lattice(3.2, 41), L2 = lattice(0.9, 43);
    const dAt = (xx, yy) => D[(yy < 0 ? 0 : yy >= N ? N - 1 : yy) * N + (xx < 0 ? 0 : xx >= N ? N - 1 : xx)];
    const job = { mode, v: 0 };
    job.done = () => { x.putImageData(img, 0, 0); c._solo = true; return c; };
    job.run = (vEnd) => {
    let o = job.v * S * 4;
    for (let v = job.v; v < vEnd; v++) {
      const fy = (v + 0.5) / WQ - 0.5, iy = Math.floor(fy), ty = fy - iy;
      for (let u = 0; u < S; u++, o += 4) {
        const fx = (u + 0.5) / WQ - 0.5, ix = Math.floor(fx), tx = fx - ix;
        const a0 = dAt(ix, iy), a1 = dAt(ix + 1, iy), b0 = dAt(ix, iy + 1), b1 = dAt(ix + 1, iy + 1);
        const top = a0 + (a1 - a0) * tx, bot = b0 + (b1 - b0) * tx;
        const n1 = noise(L1, fx, fy), n2 = noise(L2, fx, fy);
        let dep = top + (bot - top) * ty; dep += (n1 - 0.5) * 1.4 * Math.min(1, dep * 0.5);
        let k = 1; while (k < stops.length - 1 && dep > stops[k][0]) k++;
        const s0 = stops[k - 1], s1 = stops[k], f = Math.max(0, Math.min(1, (dep - s0[0]) / (s1[0] - s0[0])));
        const br = 1 + (n1 - 0.5) * 0.07 + (n2 - 0.5) * 0.05;
        px[o] = (s0[1] + (s1[1] - s0[1]) * f) * br; px[o + 1] = (s0[2] + (s1[2] - s0[2]) * f) * br; px[o + 2] = (s0[3] + (s1[3] - s0[3]) * f) * br; px[o + 3] = 255;
      }
    }
    job.v = vEnd;
    };
    return job;
  }
  // Ripple lines and sun glints scattered at random, repeated as a pattern. Lines run along the screen's horizontal.
  shimmer(ctx) {
    if (this.shim) return this.shim;
    const PS = 6 * SQ, c = document.createElement('canvas'); c.width = c.height = PS;
    const x = c.getContext('2d'), wrap = [[0, 0], [PS, 0], [-PS, 0], [0, PS], [0, -PS], [PS, PS], [-PS, -PS], [PS, -PS], [-PS, PS]];
    x.lineCap = 'round';
    for (let n = 0; n < 34; n++) {
      const px = hash(n, 1, 61) * PS, py = hash(n, 2, 61) * PS, L = 5 + hash(n, 3, 61) * 4;
      x.strokeStyle = `rgba(218,242,255,${0.35 + hash(n, 4, 61) * 0.45})`; x.lineWidth = 1.3 + hash(n, 5, 61) * 0.6;
      for (const [dx, dy] of wrap) { x.beginPath(); x.moveTo(px + dx - L / 2, py + dy + L / 2); x.lineTo(px + dx + L / 2, py + dy - L / 2); x.stroke(); }
    }
    x.fillStyle = 'rgba(255,255,255,.85)';
    for (let n = 0; n < 9; n++) { const px = hash(n, 6, 61) * PS, py = hash(n, 7, 61) * PS; for (const [dx, dy] of wrap) x.fillRect(px + dx, py + dy, 2.2, 2.2); }
    this.shimPS = PS;
    return (this.shim = ctx.createPattern(c, 'repeat'));
  }
  drawWater(ctx, w, z, cx, cy, t, mode) {
    // the part of the map on screen, in tile coordinates
    const W = this.W, H = this.H, inv = (X, Y) => { const u = (X - cx) / (32 * z), v = (Y - cy) / (16 * z); return [(u + v) / 2, (v - u) / 2]; };
    const cs = [inv(0, 0), inv(W, 0), inv(0, H), inv(W, H)];
    const vx0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[0]))) - 1), vx1 = Math.min(N, Math.ceil(Math.max(...cs.map((c) => c[0]))) + 1);
    const vy0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[1]))) - 1), vy1 = Math.min(N, Math.ceil(Math.max(...cs.map((c) => c[1]))) + 1);
    const rects = [];
    for (const [x0, y0, x1, y1] of this.waterRegions) { const a0 = Math.max(x0, vx0), b0 = Math.max(y0, vy0), a1 = Math.min(x1, vx1), b1 = Math.min(y1, vy1); if (a1 > a0 && b1 > b0) rects.push([a0, b0, a1 - a0, b1 - b0]); }
    if (!rects.length) return;
    const d = this.dpr, tex = this.waterTex(mode), day = mode === 0 ? 1 : mode === 1 ? 0.8 : 0.42;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.setTransform(d * 32 * z, d * 16 * z, -d * 32 * z, d * 16 * z, d * cx, d * cy);     // one unit = one tile
    if (ctx.gpu) {                                            // GPU: waves and twinkling glints are drawn by the water shader
      const sun = SUN[mode];
      ctx.setLight(t, sun[0], sun[1], sun[2], z * d >= 0.45 ? sun[3] : 0, N, SKY[mode]);
      ctx.fx = 16;
      for (const [x, y, rw, rh] of rects) ctx.drawImage(tex, x * WQ, y * WQ, rw * WQ, rh * WQ, x, y, rw, rh);
      ctx.fx = 0; ctx.restore(); return;
    }
    for (const [x, y, rw, rh] of rects) ctx.drawImage(tex, x * WQ, y * WQ, rw * WQ, rh * WQ, x, y, rw, rh);
    if (z * d >= 0.45) {                                     // ripples are too small to see when zoomed far out
      // two layers of a ripple pattern drifting at different speeds and sizes, so they never line up with the tiles
      const PS = (this.shimmer(ctx), this.shimPS) / SQ, k = 1.45;
      ctx.setTransform(d * 32 * z / SQ, d * 16 * z / SQ, -d * 32 * z / SQ, d * 16 * z / SQ, d * cx, d * cy);
      ctx.scale(SQ, SQ);                                     // keep working in tiles; the pattern itself is in texels
      ctx.fillStyle = this.shim;
      const layer = (sc, ox, oy, alpha) => {
        ctx.save(); ctx.globalAlpha = alpha; ctx.scale(sc / SQ, sc / SQ); ctx.translate(ox * SQ, oy * SQ);
        for (const [x, y, rw, rh] of rects) ctx.fillRect((x / sc - ox) * SQ, (y / sc - oy) * SQ, (rw / sc) * SQ, (rh / sc) * SQ);
        ctx.restore();
      };
      layer(1, (t * 0.16) % PS, (t * 0.035) % PS, (0.6 + 0.25 * Math.sin(t * 0.8)) * day);
      if (!this.game.fast) layer(k, (t * 0.07 / k + PS * 0.37) % PS, (t * 0.09 / k + PS * 0.61) % PS, (0.42 + 0.2 * Math.cos(t * 0.6)) * day);   // Smooth keeps one layer
    }
    ctx.restore();
  }
  // Soft shoreline foam for one combination of land edges, kept inside the water tile.
  foamSprite(mask) {
    if (this.foam[mask]) return this.foam[mask];
    const c = document.createElement('canvas'); c.width = 136; c.height = 72;
    const x = c.getContext('2d'); x.scale(2, 2); x.translate(34, 2); x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(0, 0); x.lineTo(32, 16); x.lineTo(0, 32); x.lineTo(-32, 16); x.closePath(); x.clip();
    const E = [[[0, 0], [32, 16]], [[32, 16], [0, 32]], [[0, 32], [-32, 16]], [[-32, 16], [0, 0]]];
    const edges = (f) => { x.beginPath(); E.forEach(([a, b], j) => { if (!(mask & (1 << j))) return; x.moveTo(a[0] * (1 - f), a[1] + (16 - a[1]) * f); x.lineTo(b[0] * (1 - f), b[1] + (16 - b[1]) * f); }); };
    edges(0); x.strokeStyle = 'rgba(235,250,255,.22)'; x.lineWidth = 9; x.stroke();      // shallow, bright water along the shore
    edges(0); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2.2; x.stroke();      // the wash line
    edges(0.16); x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 1; x.stroke();    // a second, fainter wave
    return (this.foam[mask] = c);
  }
  // One ground tile: land, road or empty lot, or the foam on a water tile (the water itself is drawn separately).
  groundTile(ctx, w, x, y, X, Y, z, mode, lvl) {
    const i = y * N + x, k = w.kind[i], ter = w.terrain[i];
    if (ter === TERRAIN.WATER) {
      const m = this.shore[i];
      if (m) { ctx.globalAlpha = FOAM_A[mode]; ctx.drawImage(this.foamSprite(m), X - 34 * z, Y - 2 * z, 68 * z, 36 * z); ctx.globalAlpha = 1; }
      if (k === T.ROAD) this.bridgeTile(ctx, w, x, y, X, Y, z, mode, lvl);
      return;
    }
    const spr = mip(k === T.ROAD ? roadSprite(w.roadMask(x, y), mode, w.level[i] === 1) : terrainSprite(ter, ter === TERRAIN.GRASS ? ((x * 7 + y * 13) % 4) : ((x + y) % 2), mode, w.tone[i]), lvl);
    ctx.drawImage(spr.c, X - 32 * z - 0.3, Y - 0.3, 64 * z + 0.6, 32 * z + 0.6);
    if (k !== T.ROAD && (ter === TERRAIN.GRASS || ter === TERRAIN.SAND)) {       // soft edges where grass meets sand, instead of a hard tile line
      for (let s2 = 0; s2 < 4; s2++) {
        const nx = x + D4R[s2][0], ny = y + D4R[s2][1]; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const q = ny * N + nx, nt = w.terrain[q]; if (w.kind[q] === T.ROAD || nt === ter || nt === TERRAIN.WATER) continue;
        ctx.drawImage(this.edgeSprite(nt, s2, mode, getSeason()), X - 32 * z, Y, 64 * z, 32 * z);
      }
    }
    if ((k === T.RES || k === T.COM || k === T.IND) && !w.level[i]) { const zs = mip(zoneSprite(k, mode), lvl); ctx.drawImage(zs.c, X - 32 * z, Y, 64 * z, 32 * z); }
  }
  // A road over water: the structure underneath, the road deck, then the railings.
  bridgeTile(ctx, w, x, y, X, Y, z, mode, lvl) {
    const axis = w.isRoad(x - 1, y) || w.isRoad(x + 1, y) ? 0 : 1;
    const endN = axis === 0 ? !w.isRoad(x + 1, y) : !w.isRoad(x, y + 1), endF = axis === 0 ? !w.isRoad(x - 1, y) : !w.isRoad(x, y - 1);
    const img = (sp, ox, oy) => ctx.drawImage(sp.c, X - ox * z, Y - oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
    img(mip(bridgeUnder(axis, (x + y) % 2 === 0 ? 1 : 0, endN ? 1 : 0, mode), lvl), 55, 0);
    const deck = mip(roadSprite(w.roadMask(x, y), mode), lvl);
    ctx.drawImage(deck.c, X - 32 * z - 0.3, Y - 0.3, 64 * z + 0.6, 32 * z + 0.6);
    img(mip(bridgeTop(axis, endN, endF, mode), lvl), 32, 5);
  }
  // Zoomed out, the ground is drawn from one cached image kept in tile space (a square per tile) and skewed into place.
  // Only tiles whose road, zone or lot changed are redrawn into it.
  // Returns true when the cache can be drawn. A full redraw (new city, or a change of day, dusk or night)
  // is spread over several frames so it never freezes the game: meanwhile the old picture, or the
  // tile-by-tile ground on the first build, is shown instead.
  updateGround(w, mode) {
    const S = N * GP, ROWS = 6;
    if (!this.gc) { this.gc = document.createElement('canvas'); this.gc.width = this.gc.height = S; this.gcx = this.gc.getContext('2d'); this.gkey = new Uint8Array(N * N); }
    const key = this.gkey, x = this.gcx;
    const kOf = (i) => { const k = w.kind[i]; return 1 + k * 2 + ((k === T.RES || k === T.COM || k === T.IND) && !w.level[i] ? 1 : 0) + (k === T.ROAD && w.level[i] ? 40 : 0); };   // avenues redraw too
    const season = getSeason();
    if (!this.gJob && (this.gFor !== w || this.gMode !== mode || this.gSeason !== season)) this.gJob = { w, mode, season, row: 0, fresh: this.gFor !== w };
    const job = this.gJob;
    if (job) {
      if (job.w !== w) { this.gJob = null; this.gFor = null; return false; }   // a new city replaced the one being drawn
      const r0 = job.row, r1 = Math.min(N, r0 + ROWS);
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
      x.beginPath(); x.rect(0, r0 * GP, S, (r1 - r0) * GP); x.clip(); x.clearRect(0, r0 * GP, S, (r1 - r0) * GP);
      x.setTransform(GP / 64, -GP / 64, GP / 32, GP / 32, 0, 0);
      for (let yy = Math.max(0, r0 - 1); yy <= Math.min(N - 1, r1); yy++) for (let xx = 0; xx < N; xx++) this.groundTile(x, w, xx, yy, (xx - yy) * 32, (xx + yy) * 16, 1, job.mode, 1);
      x.restore(); touched(this.gc, 0, r0 * GP, S, r1 * GP);
      for (let i = r0 * N; i < r1 * N; i++) key[i] = kOf(i);
      job.row = r1; this.gc2ok = false;
      if (r1 < N) return !job.fresh;                          // still working: show the old picture unless there is none
      this.gJob = null; this.gFor = w; this.gMode = job.mode; this.gSeason = job.season;
      if (job.mode !== mode) return true;                     // the light changed again meanwhile; the next frame starts over
    }
    let regions = null;
    for (let i = 0; i < N * N; i++) {
      const k = kOf(i); if (k === key[i]) continue;
      key[i] = k; const xx = i % N, yy = (i / N) | 0;
      regions = regions || new Set(); regions.add(i);                     // a road change also changes its neighbors' junctions
      if (xx > 0) regions.add(i - 1); if (xx < N - 1) regions.add(i + 1); if (yy > 0) regions.add(i - N); if (yy < N - 1) regions.add(i + N);
    }
    if (!regions) return true;
    if (regions.size > 700) { this.gMode = -1; return true; }             // so many changes that a full redraw is quicker
    for (const r of regions) {
      const rx = r % N, ry = (r / N) | 0;
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
      x.beginPath(); x.rect(rx * GP, ry * GP, GP, GP); x.clip(); x.clearRect(rx * GP, ry * GP, GP, GP);
      x.setTransform(GP / 64, -GP / 64, GP / 32, GP / 32, 0, 0);
      for (let yy = Math.max(0, ry - 1); yy <= Math.min(N - 1, ry + 1); yy++) for (let xx = Math.max(0, rx - 1); xx <= Math.min(N - 1, rx + 1); xx++) this.groundTile(x, w, xx, yy, (xx - yy) * 32, (xx + yy) * 16, 1, mode, 1);
      x.restore(); touched(this.gc, rx * GP, ry * GP, (rx + 1) * GP, (ry + 1) * GP);
    }
    this.gc2ok = false;
    return true;
  }
  drawGroundCache(ctx, z, cx, cy, zd) {
    let img = this.gc, P = GP;
    if (zd < 0.4) {                                          // very far out: a half-size copy avoids shimmering
      if (!this.gc2) { this.gc2 = document.createElement('canvas'); this.gc2.width = this.gc2.height = N * GP / 2; }
      if (!this.gc2ok) { const x2 = this.gc2.getContext('2d'); x2.imageSmoothingEnabled = true; x2.imageSmoothingQuality = 'high'; x2.clearRect(0, 0, this.gc2.width, this.gc2.height); x2.drawImage(this.gc, 0, 0, this.gc2.width, this.gc2.height); this.gc2ok = true; touched(this.gc2); }
      img = this.gc2; P = GP / 2;
    }
    const d = this.dpr;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.setTransform(d * 32 * z / P, d * 16 * z / P, -d * 32 * z / P, d * 16 * z / P, d * cx, d * cy);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  person(ctx, c, z, cx, cy, mode, t) {
    const X = (c.px - c.py) * 32 * z + cx, Y = (c.px + c.py) * 16 * z + cy;
    const d = mode === 2 ? 0.5 : mode === 1 ? 0.85 : 1, bob = c.idle || c.still ? 0 : Math.abs(Math.sin(t * 7 + c.col * 3)) * 0.8 * z;
    const cols = ['#e0483f', '#3a7bd5', '#f4c542', '#8e44ad', '#27ae60', '#e67e22', '#34495e', '#e86f9b'];
    const hex = cols[c.col % 8], h = parseInt(hex.slice(1), 16);
    const body = `rgb(${(((h >> 16) & 255) * d) | 0},${(((h >> 8) & 255) * d) | 0},${((h & 255) * d) | 0})`;
    if (mode !== 2) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(X + 2 * z, Y + 0.4 * z, 2.6 * z, 1.1 * z, 0, 0, 6.3); ctx.fill(); }
    const stride = c.idle || c.still ? 0 : Math.sin(t * 9 + c.col * 3) * 0.9 * z;                       // legs swing as they walk
    ctx.fillStyle = `rgb(${(47 * d) | 0},${(51 * d) | 0},${(64 * d) | 0})`; ctx.fillRect(X - 1.1 * z + stride * 0.5, Y - 1.6 * z - bob + Math.max(0, stride) * 0.4, 0.9 * z, 1.8 * z - Math.max(0, stride) * 0.4); ctx.fillRect(X + 0.2 * z - stride * 0.5, Y - 1.6 * z - bob + Math.max(0, -stride) * 0.4, 0.9 * z, 1.8 * z - Math.max(0, -stride) * 0.4);
    ctx.fillStyle = body; ctx.fillRect(X - 1.3 * z, Y - 6 * z - bob, 2.6 * z, 4.6 * z);
    ctx.fillStyle = `rgb(${(224 * d) | 0},${(180 * d) | 0},${(140 * d) | 0})`; ctx.beginPath(); ctx.arc(X, Y - 7.4 * z - bob, 1.6 * z, 0, 6.3); ctx.fill();
  }
  // A car is drawn from a small cached picture (one per color, direction and lighting) instead of six shapes every frame.
  carSprite(col, horiz, mode, van) {
    const cache = this.carCache || (this.carCache = []), key = col * 12 + (van ? 6 : 0) + (horiz ? 3 : 0) + mode;
    if (cache[key]) return cache[key];
    const P = (x, y, h = 0) => [(x - y) * 32, (x + y) * 16 - h];
    const l = 0.3, wd = 0.14, bw = horiz ? l : wd, bd = horiz ? wd : l, x = -bw / 2, y = -bd / 2;
    const sh = (hex, f) => { const h = parseInt(hex.slice(1), 16), d = mode === 2 ? 0.45 : mode === 1 ? 0.85 : 1; return `rgb(${Math.min(255, ((h >> 16) & 255) * f * d) | 0},${Math.min(255, ((h >> 8) & 255) * f * d) | 0},${Math.min(255, (h & 255) * f * d) | 0})`; };
    const hb = 4.5, cw = horiz ? bw * 0.5 : bw * 0.86, cd = horiz ? bd * 0.86 : bd * 0.5, x2 = x + (bw - cw) / 2, y2 = y + (bd - cd) / 2, h2 = hb + 3.4, base = CAR_COLS[col];
    const polys = [
      [[P(x, y + bd, 0), P(x + bw, y + bd, 0), P(x + bw, y + bd, hb), P(x, y + bd, hb)], sh(base, 1)],
      [[P(x + bw, y, 0), P(x + bw, y + bd, 0), P(x + bw, y + bd, hb), P(x + bw, y, hb)], sh(base, 0.76)],
      [[P(x, y, hb), P(x + bw, y, hb), P(x + bw, y + bd, hb), P(x, y + bd, hb)], sh(base, 1.1)],
      [[P(x2, y2 + cd, hb), P(x2 + cw, y2 + cd, hb), P(x2 + cw, y2 + cd, h2), P(x2, y2 + cd, h2)], sh('#d6ebf7', 1)],
      [[P(x2 + cw, y2, hb), P(x2 + cw, y2 + cd, hb), P(x2 + cw, y2 + cd, h2), P(x2 + cw, y2, h2)], sh('#9cbfd4', 1)],
      [[P(x2, y2, h2), P(x2 + cw, y2, h2), P(x2 + cw, y2 + cd, h2), P(x2, y2 + cd, h2)], sh('#e1eff7', 1)],
    ];
    if (van) {                                              // moving day: boxes strapped to the roof
      const box = (bx, by, bw2, bd2, h0, h1, c) => {
        polys.push([[P(bx, by + bd2, h0), P(bx + bw2, by + bd2, h0), P(bx + bw2, by + bd2, h1), P(bx, by + bd2, h1)], sh(c, 0.95)]);
        polys.push([[P(bx + bw2, by, h0), P(bx + bw2, by + bd2, h0), P(bx + bw2, by + bd2, h1), P(bx + bw2, by, h1)], sh(c, 0.75)]);
        polys.push([[P(bx, by, h1), P(bx + bw2, by, h1), P(bx + bw2, by + bd2, h1), P(bx, by + bd2, h1)], sh(c, 1.12)]);
      };
      const s1 = horiz ? [cw * 0.55, cd * 0.9] : [cw * 0.9, cd * 0.55];
      box(x2, y2, s1[0], s1[1], h2, h2 + 2.6, '#c8965a');
      box(x2 + (horiz ? cw * 0.45 : 0.01), y2 + (horiz ? 0.01 : cd * 0.45), s1[0] * 0.9, s1[1] * 0.9, h2, h2 + 3.6, '#b48450');
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [pts] of polys) for (const [px, py] of pts) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
    const S = 4, ox = 1 - x0, oy = 1 - y0, c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0 + 2) * S); c.height = Math.ceil((y1 - y0 + 2) * S);
    const g = c.getContext('2d'); g.scale(S, S); g.translate(ox, oy);
    for (const [pts, f] of polys) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fillStyle = f; g.fill(); }
    return (cache[key] = { c, ox, oy, S });
  }
  car(ctx, c, z, cx, cy, mode) {
    const zd = z * this.dpr, sp = mip(this.carSprite(c.col % CAR_COLS.length, c.dx !== 0, mode, !!c.van), zd <= 1 ? 2 : zd <= 2 ? 1 : 0);
    const X = (c.px - c.py) * 32 * z + cx, Y = (c.px + c.py) * 16 * z + cy;
    const fade = c.alpha !== undefined && c.alpha < 1; if (fade) ctx.globalAlpha = Math.max(0, c.alpha);   // vans fade at the map edge
    ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
    if (fade) ctx.globalAlpha = 1;
    if (mode === 2 || (mode === 1 && ctx.gpu)) this.headlights(ctx, c, z, cx, cy, mode, 0.2);
  }

}
