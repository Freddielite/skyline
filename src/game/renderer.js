import { hash } from './util.js';
import { N, T, TERRAIN } from './world.js';
import { buildingSprite, parkSprite, zoneSprite, terrainSprite, treeSprite, roadSprite, serviceSprite } from './sprites.js';
import { BT } from './buildings.js';
import { drawConstruction } from './construction.js';
import { drawSmoke, SMOKE } from './smoke.js';
import { isSignal, light } from './traffic.js';

const BG = [['#2a78a8', '#6fb4d6'], ['#3a4f86', '#c98a78'], ['#050a1f', '#14204a']];
const CAR_COLS = ['#e0b43a', '#4a7fc7', '#c9372c', '#7a5bd0', '#4aa36a', '#f2f2f2', '#e67e22', '#2c3e50'];

export class Renderer {
  constructor(canvas, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.game = game;
    this.dpr = 1; this.W = 0; this.H = 0;
    this.rain = null; this.glow = null; this.bloom = document.createElement('canvas'); this.bctx = this.bloom.getContext('2d');
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.W = Math.max(1, r.width | 0); this.H = Math.max(1, r.height | 0);
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.bloom.width = Math.max(1, (this.W / 4) | 0); this.bloom.height = Math.max(1, (this.H / 4) | 0);
  }
  glowSprite() {
    if (this.glow) return this.glow;
    const c = document.createElement('canvas'); c.width = 96; c.height = 48;
    const x = c.getContext('2d'), g = x.createRadialGradient(48, 24, 0, 48, 24, 46);
    g.addColorStop(0, 'rgba(255,217,140,.55)'); g.addColorStop(1, 'rgba(255,217,140,0)');
    x.save(); x.scale(1, 0.5); x.translate(0, 24); x.fillStyle = g; x.fillRect(0, -48, 96, 96); x.restore();
    return (this.glow = c);
  }
  draw(t) {
    if (!this.rain) this.rain = this.game.ambient.drops;
    const g = this.game, w = g.world, ctx = this.ctx, z = g.cam.zoom, mode = g.mode, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, BG[mode][0]); bg.addColorStop(1, BG[mode][1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const cx = g.cam.x, cy = g.cam.y;
    const sx = (x, y) => (x - y) * 32 * z + cx, sy = (x, y, h = 0) => (x + y) * 16 * z + cy - h * z;
    this.drawSlab(ctx, z, cx, cy, mode);
    const mX = 40 * z, top = -260 * z;

    // ground pass
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const X = sx(x, y), Y = sy(x, y);
      if (X < -mX || X > W + mX || Y < -34 * z || Y > H) continue;
      const i = y * N + x, k = w.kind[i], ter = w.terrain[i];
      let spr;
      if (k === T.ROAD) spr = roadSprite(w.roadMask(x, y), mode);
      else spr = terrainSprite(ter, ter === TERRAIN.GRASS ? ((x * 7 + y * 13) % 4) : ((x + y) % 2), mode);
      ctx.drawImage(spr.c, X - 32 * z - 0.3, Y - 0.3, 64 * z + 0.6, 32 * z + 0.6);
      if (ter === TERRAIN.WATER) this.water(ctx, x, y, X, Y, z, t, w, mode);
      else if ((k === T.RES || k === T.COM || k === T.IND) && !w.level[i]) {
        const zs = zoneSprite(k, mode); ctx.drawImage(zs.c, X - 32 * z, Y, 64 * z, 32 * z);
      }
    }
    // life on the water, then the objects pass in painter order
    this.boats(ctx, g, z, cx, cy, t, mode);
    const badges = [], smokeList = [], neon = [], wind = 0.7 + 0.5 * Math.sin(t * 0.07);
    const cars = g.cars.concat(g.people, g.trucks), buckets = new Map();
    for (const c of cars) { const kx = Math.max(0, Math.min(N - 1, Math.floor(c.px))), ky = Math.max(0, Math.min(N - 1, Math.floor(c.py))), key = ky * N + kx; (buckets.get(key) || buckets.set(key, []).get(key)).push(c); }
    for (let s = 0; s < 2 * N - 1; s++) {
      for (let x = Math.max(0, s - N + 1); x <= Math.min(s, N - 1); x++) {
        const y = s - x, X = sx(x, y), Y = sy(x, y);
        if (X < -mX * 3 || X > W + mX * 3 || Y < top || Y > H + 60 * z) continue;
        const i = y * N + x, k = w.kind[i];
        if (k === T.EMPTY && w.tree[i]) {
          const sp = treeSprite(w.tree[i], mode), rainK = g.ambient.weather.k, sw = Math.sin(t * (1.3 + rainK * 1.2) + x * 0.7 + y * 1.3) * (0.022 + rainK * 0.03) * (0.6 + wind * 0.5);
          ctx.save(); ctx.translate(X, Y + 16 * z); ctx.rotate(sw);
          ctx.drawImage(sp.c, -sp.ox * z, -sp.oy * z - 16 * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z); ctx.restore();
        }
        else if (k === T.PARK) { const sp = parkSprite(w.variant[i] % 4, mode), site = g.sites.get(i); if (site) drawConstruction(ctx, site, X, Y, z, mode, t, sp, null); else ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z); }
        else if ((k === T.RES || k === T.COM || k === T.IND) && w.level[i]) {
          const sp = buildingSprite(k, w.level[i], w.variant[i] % 4, mode, g.sim.pw[i] === 1);
          const site = g.sites.get(i), lv = w.level[i];
          if (site) { const so = site.from > 0 ? buildingSprite(k, site.from, site.pv % 4, mode, g.sim.pw[i] === 1) : null; drawConstruction(ctx, site, X, Y, z, mode, t, sp, so); }
          else ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
          if (!site) {
            const sm = SMOKE[`${k}${lv}`];
            if (sm && (k !== T.IND || g.sim.pw[i]) && (k !== T.RES || (mode >= 1 && hash(x, y, 9) > 0.35))) smokeList.push([sm, X, Y, hash(x, y, 4)]);
            if (k === T.COM && mode === 2 && g.sim.pw[i]) neon.push([X, Y + 16 * z, lv, x, y]);
          }
          if (site) { /* no status badges while building */ }
          else if (!g.sim.pw[i]) badges.push([X, Y + 16 * z - [34, 60, 100][lv - 1] * z, 'bolt']);
          else if (!g.sim.wt[i]) badges.push([X, Y + 16 * z - [34, 60, 100][lv - 1] * z, 'drop']);
          else if (lv >= 2 && !g.sim.ts[i]) badges.push([X, Y + 16 * z - [34, 60, 100][lv - 1] * z, 'trash']);
        } else if (k === T.SVC) {
          const bt = w.bt[i], def = BT[bt], dx = w.bo[i] & 3, dy = w.bo[i] >> 2;
          if (dx === def.w - 1 && dy === def.d - 1) {
            const ax = x - dx, ay = y - dy, AX = sx(ax, ay), AY = sy(ax, ay), sp = serviceSprite(bt, mode, def.power ? true : g.sim.pw[ay * N + ax] === 1);
            const site = g.sites.get(ay * N + ax);
            if (site) drawConstruction(ctx, site, AX, AY, z, mode, t, sp, null);
            else ctx.drawImage(sp.c, AX - sp.ox * z, AY - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
            if (!site) { const sm = SMOKE['s' + bt]; if (sm && (def.power || bt === 16 || g.sim.pw[ay * N + ax] === 1)) smokeList.push([sm, AX, AY, hash(ax, ay, 4)]); }
            if (bt === 2 && (!site || site.t / site.dur > 0.93)) this.blades(ctx, sx(ax + 0.5, ay + 0.5), sy(ax + 0.5, ay + 0.5, 74), z, t, mode);
            if (!site && def.use && !g.sim.pw[ay * N + ax]) badges.push([sx(ax + def.w / 2, ay + def.d / 2), sy(ax + def.w / 2, ay + def.d / 2, 66), 'bolt']);
          }
        } else if (k === T.ROAD && mode === 2 && hash(x, y, 3) > 0.72 && g.sim.powerMap[i] === 3) {
          const gs = this.glowSprite(); ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(gs, X - 48 * z * 0.8, Y - 8 * z, 96 * z * 0.8, 48 * z * 0.8); ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#3a3d44'; ctx.lineWidth = 1.4 * z; ctx.beginPath(); ctx.moveTo(X, Y + 16 * z); ctx.lineTo(X, Y + 16 * z - 16 * z); ctx.stroke();
          ctx.fillStyle = '#fff2b8'; ctx.beginPath(); ctx.arc(X, Y + 16 * z - 17 * z, 2 * z, 0, 6.3); ctx.fill();
        }
        if (z >= 0.5 && k === T.ROAD && isSignal(w, x, y)) this.signal(ctx, x, y, X, Y, z, g.clock, mode);
        const rub = g.disasters.rubble.get(i);
        if (rub !== undefined && (k === T.EMPTY || (k >= 2 && k <= 4 && !w.level[i]))) this.rubble(ctx, i, X, Y, z, rub, mode);
        const fire = g.disasters.fires.get(i);
        if (fire) this.fire(ctx, fire, X, Y, z, t, mode, k === T.SVC ? 56 : [30, 54, 94][Math.max(0, w.level[i] - 1)] || 40);
        if (z >= 0.5 && w.pipe[i] && (x + y) % 3 === 0 && !w.tree[i] && (k === T.EMPTY || k === T.ROAD || k === T.PARK)) this.manhole(ctx, X, Y, z, mode);
        if (z >= 0.45 && w.wire[i] === 1) this.pole(ctx, w, x, y, X, Y, z, mode);
        const cb = buckets.get(y * N + x);
        if (cb) for (const c of cb) { if (c.ped) { if (z >= 0.5) this.person(ctx, c, z, cx, cy, mode, t); } else if (c.truck) this.truck(ctx, c, z, cx, cy, mode, t); else if (c.bus) this.bus(ctx, c, z, cx, cy, mode); else this.car(ctx, c, z, cx, cy, mode); }
      }
    }
    if (z >= 0.35) for (const [list, X, Y, seed] of smokeList) drawSmoke(ctx, list, X, Y, z, t, mode, seed, wind);
    if (neon.length) this.neon(ctx, neon, z, t);
    this.clouds(ctx, g, z, cx, cy, t, mode);
    if (z >= 0.4) this.birds(ctx, g, z, cx, cy, t, mode);
    if (g.disasters.tornado) this.tornado(ctx, g.disasters.tornado, z, cx, cy, t, mode);
    if (g.disasters.ufo) this.ufo(ctx, g.disasters.ufo, z, cx, cy, t, mode);
    if (g.overlay) this.overlay(ctx, g, z, cx, cy);
    for (const b of badges) this.badge(ctx, b[0], b[1] - Math.sin(t * 3 + b[0]) * 1.5 * z, z, b[2]);
    // preview
    if (g.preview) {
      for (const p of g.preview.tiles) {
        const X = sx(p.x, p.y), Y = sy(p.x, p.y);
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + 32 * z, Y + 16 * z); ctx.lineTo(X, Y + 32 * z); ctx.lineTo(X - 32 * z, Y + 16 * z); ctx.closePath();
        ctx.fillStyle = p.ok ? 'rgba(242,184,75,.38)' : 'rgba(239,111,94,.42)'; ctx.fill();
        ctx.strokeStyle = p.ok ? 'rgba(242,184,75,.95)' : 'rgba(239,111,94,.95)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
    // night bloom
    if (mode > 0 && 'filter' in ctx) {
      const b = this.bctx; b.setTransform(1, 0, 0, 1, 0, 0);
      b.clearRect(0, 0, this.bloom.width, this.bloom.height);
      b.filter = mode === 2 ? 'contrast(2.2) brightness(1.15)' : 'contrast(1.6) brightness(1.1)';
      b.drawImage(this.cv, 0, 0, this.bloom.width, this.bloom.height); b.filter = 'none';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = mode === 2 ? 0.55 : 0.22; ctx.filter = 'blur(' + (6 * this.dpr) + 'px)';
      ctx.drawImage(this.bloom, 0, 0, this.cv.width, this.cv.height); ctx.restore();
    }
    this.weather(ctx, g, t, mode);
    this.vignette(ctx, mode);
  }
  signal(ctx, x, y, X, Y, z, sigT, mode) {
    const P = (lx, ly, h = 0) => [X + (lx - ly) * 32 * z, Y + (lx + ly) * 16 * z - h * z];
    const heads = [[0.94, 0.07, true], [0.07, 0.94, false]], d = mode === 2 ? 0.6 : 1;
    for (const [lx, ly, vertical] of heads) {
      const b = P(lx, ly), t = P(lx, ly, 26), st = light(sigT, x, y, vertical);
      ctx.strokeStyle = `rgb(${70 * d | 0},${74 * d | 0},${82 * d | 0})`; ctx.lineWidth = 1.5 * z; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(t[0], t[1]); ctx.stroke();
      ctx.fillStyle = `rgb(${34 * d | 0},${37 * d | 0},${44 * d | 0})`; ctx.fillRect(t[0] - 2.6 * z, t[1] - 3 * z, 5.2 * z, 12 * z);
      const cols = [['r', '#ff4b3e', 2.4], ['y', '#ffc93a', 6.6], ['g', '#3ddc6a', 10.8]];
      for (const [k, c, dy] of cols) {
        const on = st === k; ctx.fillStyle = on ? c : `rgba(70,74,84,${0.9})`; ctx.beginPath(); ctx.arc(t[0], t[1] - 3 * z + dy * z * 0.95, 1.5 * z, 0, 6.3); ctx.fill();
        if (on && (mode > 0 || k === 'r')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(t[0], t[1] - 3 * z + dy * z * 0.95, 0, t[0], t[1] - 3 * z + dy * z * 0.95, 9 * z); gl.addColorStop(0, c + 'aa'); gl.addColorStop(1, c + '00'); ctx.fillStyle = gl; ctx.fillRect(t[0] - 9 * z, t[1] - 12 * z, 18 * z, 22 * z); ctx.restore(); }
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
    if (mode === 2) { const p = P(c.px + c.dx * 0.34, c.py + c.dy * 0.34); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glowSprite(), p[0] - 20 * z, p[1] - 9 * z, 40 * z, 20 * z); ctx.restore(); }
  }
  boats(ctx, g, z, cx, cy, t, mode) {
    const d = mode === 2 ? 0.5 : mode === 1 ? 0.85 : 1;
    for (const b of g.ambient.boats) {
      const X = (b.x - b.y) * 32 * z + cx, Y = (b.x + b.y) * 16 * z + cy;
      if (X < -60 || X > this.W + 60 || Y < -60 || Y > this.H + 60) continue;
      const ang = Math.atan2((Math.cos(b.a) + Math.sin(b.a)) * 16, (Math.cos(b.a) - Math.sin(b.a)) * 32), bob = Math.sin(t * 2 + b.col) * 0.8 * z;
      ctx.save(); ctx.translate(X, Y + bob); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-Math.cos(ang) * 9 * z, -Math.sin(ang) * 4.5 * z, 12 * z, 4 * z, ang, 0, 6.3); ctx.fill();
      ctx.rotate(ang); ctx.fillStyle = `rgb(${(b.col % 2 ? 235 : 60) * d | 0},${(b.col % 2 ? 235 : 90) * d | 0},${(b.col % 2 ? 230 : 140) * d | 0})`; ctx.beginPath(); ctx.ellipse(0, 0, 8 * z, 3 * z, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = `rgb(${120 * d | 0},${80 * d | 0},${50 * d | 0})`; ctx.fillRect(-4 * z, -1 * z, 8 * z, 1.2 * z);
      if (b.sail) { ctx.rotate(-ang); ctx.fillStyle = `rgb(${250 * d | 0},${250 * d | 0},${250 * d | 0})`; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.6 * z; ctx.beginPath(); ctx.moveTo(0, -2 * z); ctx.lineTo(0, -17 * z); ctx.lineTo(8 * z, -4 * z); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-1 * z, -3 * z); ctx.lineTo(-1 * z, -13 * z); ctx.lineTo(-7 * z, -4 * z); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
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
      const c = cols[(x * 3 + y) % 4], fl = 0.7 + 0.3 * Math.sin(t * 3.1 + x * 1.7 + y), hh = [20, 36, 60][lv - 1] * z, r = (13 + lv * 4) * z;
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
    if (mode === 2) { const p = P(c.px + c.dx * 0.32, c.py + c.dy * 0.32); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glowSprite(), p[0] - 18 * z, p[1] - 8 * z, 36 * z, 18 * z); ctx.restore(); }
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
    const r = 8 * z; if (z < 0.6) return;
    ctx.fillStyle = type === 'bolt' ? '#ef6f5e' : type === 'trash' ? '#a0703c' : '#3d8bd9'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 * z;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    if (type === 'bolt') { ctx.moveTo(X + 1.5 * z, Y - 5 * z); ctx.lineTo(X - 3 * z, Y + 1 * z); ctx.lineTo(X, Y + 1 * z); ctx.lineTo(X - 1.5 * z, Y + 5 * z); ctx.lineTo(X + 3 * z, Y - 1.2 * z); ctx.lineTo(X + 0.2 * z, Y - 1.2 * z); ctx.closePath(); }
    else if (type === 'trash') { ctx.rect(X - 3 * z, Y - 2 * z, 6 * z, 7 * z); ctx.rect(X - 4 * z, Y - 4 * z, 8 * z, 1.6 * z); ctx.rect(X - 1.5 * z, Y - 5.6 * z, 3 * z, 1.4 * z); }
    else { ctx.moveTo(X, Y - 5 * z); ctx.quadraticCurveTo(X + 5 * z, Y + 1 * z, X, Y + 5 * z); ctx.quadraticCurveTo(X - 5 * z, Y + 1 * z, X, Y - 5 * z); }
    ctx.fill();
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
        case 'crime': col = ramp(1 - sim.crime[i] / 70, 0.6); break;
        case 'pollution': if (sim.poll[i] > 2) col = ramp(1 - sim.poll[i] / 60, 0.62); break;
        case 'police': if (sim.cov.police[i] > 0.02) col = `rgba(80,140,255,${0.2 + sim.cov.police[i] * 0.5})`; break;
        case 'fire': if (sim.cov.fire[i] > 0.02) col = `rgba(255,110,70,${0.2 + sim.cov.fire[i] * 0.5})`; break;
        case 'health': if (sim.cov.health[i] > 0.02) col = `rgba(255,120,170,${0.2 + sim.cov.health[i] * 0.5})`; break;
        case 'traffic': if (w.kind[i] === T.ROAD) col = ramp(1 - Math.min(1, g.density[i] / 2.2), 0.75); break;
        case 'transit': if (sim.cov.transit[i] > 0.02) col = `rgba(70,200,190,${0.2 + sim.cov.transit[i] * 0.5})`; break;
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
  water(ctx, x, y, X, Y, z, t, w, mode) {
    const h = hash(x, y, 1), day = mode === 0 ? 1 : mode === 1 ? 0.8 : 0.45;
    ctx.lineCap = 'round'; ctx.lineWidth = 1.1 * z;
    for (let k = 0; k < 2; k++) {
      const off = (((t * 5 + h * 40 + k * 21) % 42) - 21) * z, a = Math.max(0.05, 0.38 * Math.sin(((off / z + 21) / 42) * Math.PI)) * day;
      ctx.strokeStyle = `rgba(200,235,252,${a})`; ctx.beginPath(); ctx.moveTo(X - 8 * z + off, Y + (11 + k * 9) * z + off * 0.5); ctx.lineTo(X + 6 * z + off, Y + (11 + k * 9) * z + off * 0.5); ctx.stroke();
    }
    if (mode !== 2 && hash(x, y, Math.floor(t * 1.6)) > 0.955) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(X - 6 * z + hash(y, x, Math.floor(t * 1.6)) * 12 * z, Y + (8 + hash(x, x, 3) * 14) * z, 1.6 * z, 1.6 * z); }
    // foam where water meets land
    const land = (xx, yy) => xx >= 0 && yy >= 0 && xx < N && yy < N && w.terrain[yy * N + xx] !== TERRAIN.WATER;
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.6 * z; ctx.beginPath();
    if (land(x, y - 1)) { ctx.moveTo(X, Y); ctx.lineTo(X + 32 * z, Y + 16 * z); }
    if (land(x + 1, y)) { ctx.moveTo(X + 32 * z, Y + 16 * z); ctx.lineTo(X, Y + 32 * z); }
    if (land(x, y + 1)) { ctx.moveTo(X, Y + 32 * z); ctx.lineTo(X - 32 * z, Y + 16 * z); }
    if (land(x - 1, y)) { ctx.moveTo(X - 32 * z, Y + 16 * z); ctx.lineTo(X, Y); }
    ctx.stroke();
  }
  person(ctx, c, z, cx, cy, mode, t) {
    const X = (c.px - c.py) * 32 * z + cx, Y = (c.px + c.py) * 16 * z + cy;
    const d = mode === 2 ? 0.5 : mode === 1 ? 0.85 : 1, bob = c.idle || c.still ? 0 : Math.abs(Math.sin(t * 7 + c.col * 3)) * 0.8 * z;
    const cols = ['#e0483f', '#3a7bd5', '#f4c542', '#8e44ad', '#27ae60', '#e67e22', '#34495e', '#e86f9b'];
    const hex = cols[c.col % 8], h = parseInt(hex.slice(1), 16);
    const body = `rgb(${(((h >> 16) & 255) * d) | 0},${(((h >> 8) & 255) * d) | 0},${((h & 255) * d) | 0})`;
    if (mode !== 2) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(X + 2 * z, Y + 0.4 * z, 2.6 * z, 1.1 * z, 0, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = `rgb(${(47 * d) | 0},${(51 * d) | 0},${(64 * d) | 0})`; ctx.fillRect(X - 1.1 * z, Y - 1.6 * z - bob, 0.9 * z, 1.8 * z); ctx.fillRect(X + 0.2 * z, Y - 1.6 * z - bob, 0.9 * z, 1.8 * z);
    ctx.fillStyle = body; ctx.fillRect(X - 1.3 * z, Y - 6 * z - bob, 2.6 * z, 4.6 * z);
    ctx.fillStyle = `rgb(${(224 * d) | 0},${(180 * d) | 0},${(140 * d) | 0})`; ctx.beginPath(); ctx.arc(X, Y - 7.4 * z - bob, 1.6 * z, 0, 6.3); ctx.fill();
  }
  car(ctx, c, z, cx, cy, mode) {
    const P = (x, y, h = 0) => [(x - y) * 32 * z + cx, (x + y) * 16 * z + cy - h * z];
    const horiz = c.dx !== 0;
    const l = 0.3, wd = 0.14;
    const bw = horiz ? l : wd, bd = horiz ? wd : l;
    const x = c.px - bw / 2, y = c.py - bd / 2;
    const col = CAR_COLS[c.col % CAR_COLS.length];
    const sh = (hex, f) => { const h = parseInt(hex.slice(1), 16); const r = ((h >> 16) & 255) * f, g = ((h >> 8) & 255) * f, b = (h & 255) * f; const d = mode === 2 ? 0.45 : mode === 1 ? 0.85 : 1; return `rgb(${Math.min(255, r * d) | 0},${Math.min(255, g * d) | 0},${Math.min(255, b * d) | 0})`; };
    const poly = (a, f) => { ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) ctx.lineTo(a[i][0], a[i][1]); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); };
    const hb = 4.5;
    poly([P(x, y + bd, 0), P(x + bw, y + bd, 0), P(x + bw, y + bd, hb), P(x, y + bd, hb)], sh(col, 1));
    poly([P(x + bw, y, 0), P(x + bw, y + bd, 0), P(x + bw, y + bd, hb), P(x + bw, y, hb)], sh(col, 0.76));
    poly([P(x, y, hb), P(x + bw, y, hb), P(x + bw, y + bd, hb), P(x, y + bd, hb)], sh(col, 1.1));
    const cw = horiz ? bw * 0.5 : bw * 0.86, cd = horiz ? bd * 0.86 : bd * 0.5, x2 = x + (bw - cw) / 2, y2 = y + (bd - cd) / 2, h2 = hb + 3.4;
    poly([P(x2, y2 + cd, hb), P(x2 + cw, y2 + cd, hb), P(x2 + cw, y2 + cd, h2), P(x2, y2 + cd, h2)], sh('#d6ebf7', 1));
    poly([P(x2 + cw, y2, hb), P(x2 + cw, y2 + cd, hb), P(x2 + cw, y2 + cd, h2), P(x2 + cw, y2, h2)], sh('#9cbfd4', 1));
    poly([P(x2, y2, h2), P(x2 + cw, y2, h2), P(x2 + cw, y2 + cd, h2), P(x2, y2 + cd, h2)], sh('#e1eff7', 1));
    if (mode === 2) {
      const hx = c.px + c.dx * 0.2, hy = c.py + c.dy * 0.2, p = P(hx, hy);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glowSprite(), p[0] - 18 * z, p[1] - 8 * z, 36 * z, 18 * z); ctx.restore();
    }
  }
}
