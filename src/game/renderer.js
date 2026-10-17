import { hash } from './util.js';
import { N, T, TERRAIN } from './world.js';
import { buildingSprite, parkSprite, zoneSprite, terrainSprite, treeSprite, roadSprite, serviceSprite } from './sprites.js';
import { BT } from './buildings.js';

const BG = [['#2a78a8', '#6fb4d6'], ['#3a4f86', '#c98a78'], ['#050a1f', '#14204a']];
const CAR_COLS = ['#e0b43a', '#4a7fc7', '#c9372c', '#7a5bd0', '#4aa36a', '#f2f2f2', '#e67e22', '#2c3e50'];

export class Renderer {
  constructor(canvas, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.game = game;
    this.dpr = 1; this.W = 0; this.H = 0;
    this.glow = null; this.bloom = document.createElement('canvas'); this.bctx = this.bloom.getContext('2d');
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
    // objects pass in painter order
    const badges = [];
    const cars = g.cars.concat(g.people), buckets = new Map();
    for (const c of cars) { const kx = Math.max(0, Math.min(N - 1, Math.floor(c.px))), ky = Math.max(0, Math.min(N - 1, Math.floor(c.py))), key = ky * N + kx; (buckets.get(key) || buckets.set(key, []).get(key)).push(c); }
    for (let s = 0; s < 2 * N - 1; s++) {
      for (let x = Math.max(0, s - N + 1); x <= Math.min(s, N - 1); x++) {
        const y = s - x, X = sx(x, y), Y = sy(x, y);
        if (X < -mX * 3 || X > W + mX * 3 || Y < top || Y > H + 60 * z) continue;
        const i = y * N + x, k = w.kind[i];
        if (k === T.EMPTY && w.tree[i]) { const sp = treeSprite(w.tree[i], mode); ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z); }
        else if (k === T.PARK) { const sp = parkSprite(w.variant[i] % 4, mode); ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z); }
        else if ((k === T.RES || k === T.COM || k === T.IND) && w.level[i]) {
          const sp = buildingSprite(k, w.level[i], w.variant[i] % 4, mode);
          ctx.drawImage(sp.c, X - sp.ox * z, Y - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
          const lv = w.level[i];
          if (!g.sim.pw[i]) badges.push([X, Y + 16 * z - [34, 60, 100][lv - 1] * z, 'bolt']);
          else if (!g.sim.wt[i]) badges.push([X, Y + 16 * z - [34, 60, 100][lv - 1] * z, 'drop']);
        } else if (k === T.SVC) {
          const bt = w.bt[i], def = BT[bt], dx = w.bo[i] & 3, dy = w.bo[i] >> 2;
          if (dx === def.w - 1 && dy === def.d - 1) {
            const ax = x - dx, ay = y - dy, AX = sx(ax, ay), AY = sy(ax, ay), sp = serviceSprite(bt, mode);
            ctx.drawImage(sp.c, AX - sp.ox * z, AY - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
            if (bt === 2) this.blades(ctx, sx(ax + 0.5, ay + 0.5), sy(ax + 0.5, ay + 0.5, 74), z, t, mode);
            if (def.use && !g.sim.pw[ay * N + ax]) badges.push([sx(ax + def.w / 2, ay + def.d / 2), sy(ax + def.w / 2, ay + def.d / 2, 66), 'bolt']);
          }
        } else if (k === T.ROAD && mode === 2 && hash(x, y, 3) > 0.72) {
          const gs = this.glowSprite(); ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(gs, X - 48 * z * 0.8, Y - 8 * z, 96 * z * 0.8, 48 * z * 0.8); ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#3a3d44'; ctx.lineWidth = 1.4 * z; ctx.beginPath(); ctx.moveTo(X, Y + 16 * z); ctx.lineTo(X, Y + 16 * z - 16 * z); ctx.stroke();
          ctx.fillStyle = '#fff2b8'; ctx.beginPath(); ctx.arc(X, Y + 16 * z - 17 * z, 2 * z, 0, 6.3); ctx.fill();
        }
        const cb = buckets.get(y * N + x);
        if (cb) for (const c of cb) { if (c.ped) this.person(ctx, c, z, cx, cy, mode, t); else this.car(ctx, c, z, cx, cy, mode); }
      }
    }
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
    ctx.fillStyle = type === 'bolt' ? '#ef6f5e' : '#3d8bd9'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 * z;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    if (type === 'bolt') { ctx.moveTo(X + 1.5 * z, Y - 5 * z); ctx.lineTo(X - 3 * z, Y + 1 * z); ctx.lineTo(X, Y + 1 * z); ctx.lineTo(X - 1.5 * z, Y + 5 * z); ctx.lineTo(X + 3 * z, Y - 1.2 * z); ctx.lineTo(X + 0.2 * z, Y - 1.2 * z); ctx.closePath(); }
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
        case 'edu': if (sim.cov.edu[i] > 0.02) col = `rgba(240,200,70,${0.2 + sim.cov.edu[i] * 0.5})`; break;
        case 'power': { const m = sim.powerMap[i]; col = m === 1 ? 'rgba(95,211,166,.7)' : m === 2 ? 'rgba(239,111,94,.8)' : m === 3 ? 'rgba(242,184,75,.4)' : null; break; }
        case 'water': { const m = sim.waterMap[i]; col = m === 3 ? 'rgba(95,211,166,.7)' : m === 2 ? 'rgba(239,111,94,.8)' : m === 1 ? 'rgba(61,139,217,.32)' : null; break; }
      }
      if (!col) continue;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + 32 * z, Y + 16 * z); ctx.lineTo(X, Y + 32 * z); ctx.lineTo(X - 32 * z, Y + 16 * z); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
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
    const a = 0.25 + 0.35 * Math.sin(t * 1.6 + hash(x, y, 1) * 6.28);
    ctx.strokeStyle = `rgba(190,230,250,${Math.max(0.05, a)})`; ctx.lineWidth = 1.1 * z; ctx.lineCap = 'round';
    const ox = hash(x, y, 2) * 14;
    ctx.beginPath(); ctx.moveTo(X - 10 * z + ox * z * 0.4, Y + 14 * z); ctx.lineTo(X + 4 * z + ox * z * 0.4, Y + 14 * z);
    ctx.moveTo(X - 2 * z, Y + 21 * z); ctx.lineTo(X + 12 * z, Y + 21 * z); ctx.stroke();
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
    const d = mode === 2 ? 0.5 : mode === 1 ? 0.85 : 1, bob = Math.abs(Math.sin(t * 7 + c.col * 3)) * 0.8 * z;
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
