import { tint, shade, mix, hash, lerp } from './util.js';
import { T, TERRAIN } from './world.js';

const S = 2;               // supersampling for crisp zoom
const cache = new Map();
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w * S; c.height = h * S; return c; };

function kit(ctx, mode, ox, oy, lit = true) {
  const C = (h) => tint(h, mode);
  const P = (x, y, z = 0) => [ox + (x - y) * 32, oy + (x + y) * 16 - z];
  const path = (a) => { ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) ctx.lineTo(a[i][0], a[i][1]); ctx.closePath(); };
  const vgrad = (a, k) => {
    let mn = 1e9, mxx = -1e9;
    for (const p of a) { mn = Math.min(mn, p[1]); mxx = Math.max(mxx, p[1]); }
    const g = ctx.createLinearGradient(0, mn, 0, mxx + 0.01);
    g.addColorStop(0, `rgba(255,255,255,${0.16 * k})`); g.addColorStop(1, `rgba(0,0,0,${0.18 * k})`);
    return g;
  };
  const poly = (a, fill, ov, noStroke) => {
    path(a); ctx.fillStyle = fill; ctx.fill();
    if (!noStroke) { ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 0.6; ctx.lineJoin = 'round'; ctx.stroke(); }
    if (ov) { path(a); ctx.fillStyle = ov === 'glass' ? glassGrad(a) : vgrad(a, 1); ctx.fill(); }
  };
  const glassGrad = (a) => {
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (const p of a) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }
    const g = ctx.createLinearGradient(mnx, mny, mxx, mxy);
    g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(0,0,0,.1)');
    return g;
  };
  const line = (a, b, col, w = 1, dash) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); };
  const circ = (p, r, f) => { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fillStyle = f; ctx.fill(); };
  const ell = (p, rx, ry, f) => { ctx.beginPath(); ctx.ellipse(p[0], p[1], rx, ry, 0, 0, 6.2832); ctx.fillStyle = f; ctx.fill(); };
  const faces = (b) => ({ l: b, r: shade(b, 0.76), t: shade(b, 1.1) });
  const box = (x, y, w, d, h, col, z0 = 0) => {
    const t = z0 + h;
    poly([P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, t), P(x, y + d, t)], C(col.l), true);
    poly([P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, t), P(x + w, y, t)], C(col.r), true);
    poly([P(x, y, t), P(x + w, y, t), P(x + w, y + d, t), P(x, y + d, t)], C(col.t));
  };
  const sh = (x, y, w, d, h) => {
    ctx.fillStyle = `rgba(0,0,0,${mode === 2 ? 0.22 : 0.16})`;
    path([P(x - 0.05, y - 0.05), P(x + w + 0.05, y - 0.05), P(x + w + 0.05, y + d + 0.05), P(x - 0.05, y + d + 0.05)]); ctx.fill();
    if (mode === 2) return;
    const s = Math.min(1.5, (h / 70) * (mode === 1 ? 1.7 : 1)), o = mode === 1 ? 0.2 : 0.15;
    ctx.fillStyle = `rgba(10,20,40,${o})`;
    path([P(x + w, y), P(x + w + s, y + s * 0.2), P(x + w + s, y + d + s * 0.2), P(x + w, y + d)]); ctx.fill();
    ctx.fillStyle = `rgba(10,20,40,${o * 0.8})`;
    path([P(x + w, y), P(x + w + s * 0.5, y + s * 0.1), P(x + w + s * 0.5, y + d + s * 0.1), P(x + w, y + d)]); ctx.fill();
  };
  const win = (a, r, side, gl) => {
    let f;
    if (mode === 2) f = lit && r > 0.45 ? (side ? '#f0bf6a' : '#ffd98c') : (side ? '#1b2a52' : '#223360');
    else { f = gl ? (side ? '#9fc9e2' : '#d6eefa') : (side ? '#7ea6c6' : '#b7dbf2'); if (mode === 1) f = mix(f, '#ffc58a', 0.45); }
    path(a); ctx.fillStyle = f; ctx.fill();
    if (mode !== 2) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.6; ctx.stroke(); }
  };
  const wins = (x, y, w, d, h, sd, o = {}) => {
    const rh = o.rh || 10, wh = o.wh || 5.5, base = o.base || 8, dn = o.dens || 3.5;
    const nl = Math.max(2, Math.round(w * dn)), nr = Math.max(2, Math.round(d * dn));
    for (let z = base; z + wh <= h - 4; z += rh) {
      for (let i = 0; i < nl; i++) { const u0 = x + w * (i + 0.22) / nl, u1 = x + w * (i + 0.78) / nl; win([P(u0, y + d, z), P(u1, y + d, z), P(u1, y + d, z + wh), P(u0, y + d, z + wh)], hash(sd, z, i), 0, o.glass); }
      for (let i = 0; i < nr; i++) { const v0 = y + d * (i + 0.22) / nr, v1 = y + d * (i + 0.78) / nr; win([P(x + w, v0, z), P(x + w, v1, z), P(x + w, v1, z + wh), P(x + w, v0, z + wh)], hash(sd, z, i + 9), 1, o.glass); }
    }
  };
  const cyl = (x, y, r, h, base, z0 = 0) => {
    const p = P(x, y, z0), cx = p[0], cy = p[1], ry = r / 2;
    ctx.beginPath(); ctx.moveTo(cx - r, cy - h); ctx.lineTo(cx, cy - h); ctx.lineTo(cx, cy + ry); ctx.ellipse(cx, cy, r, ry, 0, Math.PI / 2, Math.PI, false); ctx.closePath(); ctx.fillStyle = C(base); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy - h); ctx.lineTo(cx + r, cy - h); ctx.lineTo(cx + r, cy); ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI / 2, false); ctx.closePath(); ctx.fillStyle = C(shade(base, 0.76)); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy - h, r, ry, 0, 0, 6.2832); ctx.fillStyle = C(shade(base, 1.12)); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 0.5; ctx.stroke();
  };
  const tree = (x, y, k, sd) => {
    const p = P(x, y), cx = p[0], cy = p[1], r = 7 + hash(sd, 1, 1) * 4;
    if (mode !== 2) ell([cx + r * 0.8, cy + 1], r * 0.95, r * 0.45, 'rgba(0,0,0,.2)');
    ctx.fillStyle = C('#6b4a2f'); ctx.fillRect(cx - 1.5, cy - 8, 3, 8);
    if (k === 1) {
      for (let i = 0; i < 3; i++) {
        const by = cy - 5 - i * 7, hw = 9 - i * 2.2;
        ctx.beginPath(); ctx.moveTo(cx - hw, by); ctx.lineTo(cx + hw, by); ctx.lineTo(cx, by - 11); ctx.closePath(); ctx.fillStyle = C('#2b7342'); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - hw, by); ctx.lineTo(cx, by); ctx.lineTo(cx, by - 11); ctx.closePath(); ctx.fillStyle = C('#3c9257'); ctx.fill();
      }
    } else {
      const pal = k === 2 ? ['#c26a22', '#e08a2e', '#f2b04a'] : k === 3 ? ['#4d9a45', '#6cba58', '#92d878'] : ['#3b8636', '#56a845', '#79c85f'];
      circ([cx + r * 0.2, cy - 8 - r * 0.45], r * 0.85, C(shade(pal[0], 0.8)));
      circ([cx, cy - 8 - r * 0.7], r, C(pal[0]));
      circ([cx - r * 0.2, cy - 8 - r * 0.9], r * 0.8, C(pal[1]));
      circ([cx - r * 0.35, cy - 8 - r * 1.05], r * 0.45, C(pal[2]));
      circ([cx + r * 0.45, cy - 8 - r * 0.4], r * 0.3, C(shade(pal[0], 0.7)));
    }
  };
  const pad = (col, speck) => {
    poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], C(col), null, true);
    if (speck) for (let i = 0; i < 9; i++) { const p = P(hash(i, 1, 4) * 0.9 + 0.05, hash(i, 2, 5) * 0.9 + 0.05); line(p, [p[0] + 1.8, p[1] - 1.4], C(speck[i % speck.length]), 0.9); }
  };
  const smoke = (p, n = 3) => { for (let i = 0; i < n; i++) circ([p[0] + i * 7, p[1] - i * 12], 6 + i * 2.5, mode === 2 ? `rgba(141,150,173,${0.7 - i * 0.2})` : `rgba(236,239,243,${0.85 - i * 0.25})`); };
  const store = () => C(mode === 2 && lit ? '#ffd98c' : '#35566b');
  return { C, P, path, poly, line, circ, ell, faces, box, sh, win, wins, cyl, tree, pad, smoke, ctx, mode, lit, store };
}

const WALL = ['#f2e6cd', '#e8cdb5', '#d9e6ef', '#f5dca8', '#e9d9ee'];
const ROOF = ['#c4553a', '#8d4b3c', '#566a8c', '#a9473b', '#6f5a8d'];
const MID = ['#d9c7a5', '#c98a72', '#9db3c8', '#b9c9a0'];
const COOL = ['#aab6c4', '#c9b8a6', '#9fb0a0', '#b7a9c4'];
const GLASS = ['#6db6de', '#7aa7d6', '#68bfc0', '#8aa4c8'];
const AWN = ['#c0392b', '#2e86c1', '#27ae60', '#e67e22', '#8e44ad'];

function house(k, v) {
  const { P, poly, box, win, faces, sh, C, circ, line, ctx } = k;
  const x = 0.16, y = 0.1, w = 0.62 + (v % 2) * 0.04, d = 0.54, h = 22, rh = 14, ym = y + d / 2;
  const wall = WALL[v % 5], roof = ROOF[(v * 2 + 1) % 5], f = faces(wall);
  const pos = (u, t) => P(x + w * u, lerp(y + d, ym, t), h + rh * t);
  k.pad('#a9dc8e', ['#4d8f3c', '#8fd070', '#3f7f34']);
  poly([P(0.48, 0.64), P(0.7, 0.64), P(0.7, 1), P(0.48, 1)], C('#b4b7bd'), null, true);
  k.sh(x, y, w, d, h + rh * 0.6);
  box(x, y, w, d, h, f);
  win([P(x + 0.2, y + d, 7), P(x + 0.3, y + d, 7), P(x + 0.3, y + d, 15), P(x + 0.2, y + d, 15)], hash(v, 1, 1), 0);
  win([P(x + w, y + 0.1, 7), P(x + w, y + 0.2, 7), P(x + w, y + 0.2, 15), P(x + w, y + 0.1, 15)], hash(v, 2, 1), 1);
  win([P(x + w, y + 0.32, 7), P(x + w, y + 0.42, 7), P(x + w, y + 0.42, 15), P(x + w, y + 0.32, 15)], hash(v, 3, 1), 1);
  poly([P(x + 0.06, y + d, 0), P(x + 0.15, y + d, 0), P(x + 0.15, y + d, 13), P(x + 0.06, y + d, 13)], C('#6b4430'));
  poly([P(x + w - 0.3, y + d, 0), P(x + w - 0.08, y + d, 0), P(x + w - 0.08, y + d, 11), P(x + w - 0.08 - 0.22, y + d, 11)], C('#e9e6df'));
  poly([P(x, y, h), P(x + w, y, h), P(x + w, ym, h + rh), P(x, ym, h + rh)], C(shade(roof, 0.8)));
  poly([P(x + w, y, h), P(x + w, y + d, h), P(x + w, ym, h + rh)], C(f.r), 'v');
  box(x + w * 0.7, y + 0.05, 0.1, 0.1, 18, faces('#9c5a46'), h - 1);
  poly([pos(0, 0), pos(1, 0), pos(1, 1), pos(0, 1)], C(roof), 'v');
  for (let i = 1; i < 7; i++) { const t = i / 7; line(pos(0, t), pos(1, t), 'rgba(0,0,0,.2)', 0.6); }
  if (hash(v, 4, 4) > 0.5) { poly([pos(0.12, 0.2), pos(0.55, 0.2), pos(0.55, 0.82), pos(0.12, 0.82)], C('#1f3a5f')); line(pos(0.335, 0.2), pos(0.335, 0.82), '#9db6d6', 0.5); line(pos(0.12, 0.5), pos(0.55, 0.5), '#9db6d6', 0.5); }
  circ(P(0.14, 0.8), 4.4, C('#3f8f3a')); circ(P(0.9, 0.86), 3.8, C('#4a9a42')); circ(P(0.32, 0.86), 1.7, C('#e86f9b'));
}
function apartment(k, v) {
  const { P, poly, box, faces, sh, C, line, cyl, ell } = k;
  const x = 0.13, y = 0.13, w = 0.74, d = 0.7, h = 48, f = faces(MID[v % 4]);
  k.pad('#b9d9a0', ['#4d8f3c', '#8fd070']);
  sh(x, y, w, d, h);
  box(x, y, w, d, h, f);
  k.wins(x, y, w, d, h, v + 3, { dens: 3.6, rh: 10, wh: 5.5, base: 14 });
  for (let z = 12; z < h; z += 10) line(P(x, y + d, z), P(x + w, y + d, z), 'rgba(0,0,0,.14)', 0.6);
  poly([P(x + 0.08, y + d, 1), P(x + w - 0.08, y + d, 1), P(x + w - 0.08, y + d, 11), P(x + 0.08, y + d, 11)], k.store());
  poly([P(x + 0.08, y + d, 13), P(x + w - 0.08, y + d, 13), P(x + w - 0.08, y + d + 0.13, 9), P(x + 0.08, y + d + 0.13, 9)], C(AWN[v % 5]));
  box(x + 0.1, y + 0.1, 0.22, 0.2, 5, faces('#9aa0a8'), h); box(x + 0.4, y + 0.3, 0.2, 0.18, 4, faces('#b0b5bc'), h);
  cyl(x + w * 0.7, y + d * 0.28, 5, 11, '#9c7a55', h);
}
function tower(k, v) {
  const { P, line, circ, box, faces, sh, poly, C } = k;
  const x = 0.17, y = 0.17, w = 0.66, d = 0.66, h = 88, f = faces(COOL[v % 4]);
  k.pad('#c8cace', null);
  sh(x, y, w, d, h + 14);
  box(x, y, w, d, h, f);
  k.wins(x, y, w, d, h, v + 11, { dens: 4.2, rh: 8.5, wh: 4.5, base: 14 });
  poly([P(x + 0.08, y + d, 1), P(x + w - 0.08, y + d, 1), P(x + w - 0.08, y + d, 11), P(x + 0.08, y + d, 11)], k.store());
  box(x + 0.12, y + 0.12, w - 0.24, d - 0.24, 14, f, h);
  const p = P(x + w / 2, y + d / 2, h + 14);
  line(p, [p[0], p[1] - 22], C('#c9d3de'), 1.2); circ([p[0], p[1] - 23], 1.8, '#ff3b30');
}
function shop(k, v) {
  const { P, poly, box, faces, sh, C, line } = k;
  const x = 0.1, y = 0.14, w = 0.8, d = 0.7, h = 26;
  k.pad('#cfd1d4', null);
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: ['#e5d9c0', '#d8c3b0', '#c9d3dc', '#e6cdb5'][v % 4], r: shade(['#e5d9c0', '#d8c3b0', '#c9d3dc', '#e6cdb5'][v % 4], 0.76), t: '#a3a9b3' });
  poly([P(x + 0.07, y + d, 1), P(x + w - 0.07, y + d, 1), P(x + w - 0.07, y + d, 14), P(x + 0.07, y + d, 14)], k.store());
  for (let i = 1; i < 6; i++) { const u = lerp(x + 0.07, x + w - 0.07, i / 6); line(P(u, y + d, 1), P(u, y + d, 14), 'rgba(255,255,255,.45)', 0.7); }
  poly([P(x + 0.04, y + d, 17), P(x + w - 0.04, y + d, 17), P(x + w - 0.04, y + d + 0.14, 11), P(x + 0.04, y + d + 0.14, 11)], C(AWN[(v + 1) % 5]));
  for (let i = 1; i < 6; i++) { const u = lerp(x + 0.04, x + w - 0.04, i / 6); line(P(u, y + d, 17), P(u, y + d + 0.14, 11), 'rgba(255,255,255,.55)', 1.2); }
  box(x + 0.15, y + 0.15, 0.22, 0.2, 5, faces('#9aa0a8'), h);
  box(x + 0.25, y + d - 0.05, 0.4, 0.05, 6, { l: '#c0392b', r: '#8e2a20', t: '#e0564a' }, h - 1);
}
function office(k, v) {
  const { P, poly, box, faces, sh, C, line, cyl } = k;
  const x = 0.1, y = 0.11, w = 0.8, d = 0.78, h = 62, f = faces(MID[(v + 2) % 4]);
  k.pad('#cfd1d4', null);
  sh(x, y, w, d, h);
  box(x, y, w, d, h, f);
  k.wins(x, y, w, d, h, v + 21, { dens: 3.8, rh: 9, wh: 5, base: 16 });
  poly([P(x + 0.07, y + d, 1), P(x + w - 0.07, y + d, 1), P(x + w - 0.07, y + d, 12), P(x + 0.07, y + d, 12)], k.store());
  poly([P(x + 0.07, y + d, 14), P(x + w - 0.07, y + d, 14), P(x + w - 0.07, y + d + 0.13, 10), P(x + 0.07, y + d + 0.13, 10)], C(AWN[(v + 2) % 5]));
  box(x + 0.12, y + 0.14, 0.28, 0.26, 5, faces('#9aa0a8'), h); box(x + 0.5, y + 0.45, 0.22, 0.2, 4, faces('#b0b5bc'), h);
  if (v % 2) cyl(x + w * 0.72, y + d * 0.3, 5, 11, '#9c7a55', h);
}
function glassTower(k, v) {
  const { P, poly, box, faces, sh, C, line, circ } = k;
  const x = 0.12, y = 0.12, w = 0.76, d = 0.76, h = 122, f = faces(GLASS[v % 4]);
  k.pad('#c8cace', null);
  sh(x, y, w, d, h + 26);
  box(x, y, w, d, h, f);
  poly([P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x, y + d, h)], 'rgba(0,0,0,0)', 'glass', true);
  poly([P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x + w, y, h)], 'rgba(0,0,0,0)', 'glass', true);
  k.wins(x, y, w, d, h, v + 31, { dens: 4.6, rh: 7.5, wh: 4.2, base: 14, glass: 1 });
  poly([P(x + 0.07, y + d, 1), P(x + w - 0.07, y + d, 1), P(x + w - 0.07, y + d, 11), P(x + 0.07, y + d, 11)], k.store());
  box(x + 0.14, y + 0.14, w - 0.28, d - 0.28, 16, f, h);
  box(x + 0.26, y + 0.26, w - 0.52, d - 0.52, 10, f, h + 16);
  const p = P(x + w / 2, y + d / 2, h + 26);
  line(p, [p[0], p[1] - 26], C('#c9d3de'), 1.2); circ([p[0], p[1] - 27], 2, '#ff3b30');
}
function warehouse(k, v) {
  const { P, poly, box, faces, sh, C, line } = k;
  const x = 0.07, y = 0.14, w = 0.86, d = 0.7, h = 26, col = ['#c9ccd2', '#d3d7de', '#c7c2b2', '#b8c2cc'][v % 4];
  k.pad('#a9a493', ['#8a8574', '#bdb8a6']);
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: col, r: shade(col, 0.76), t: '#8f98a6' });
  for (let i = 1; i < 10; i++) { const u = x + w * i / 10; line(P(u, y, h), P(u, y + d, h), 'rgba(0,0,0,.2)', 0.7); }
  for (let i = 0; i < 3; i++) {
    const u = x + w * (i + 0.2) / 3, u2 = x + w * (i + 0.7) / 3;
    poly([P(u, y + d, 0), P(u2, y + d, 0), P(u2, y + d, 12), P(u, y + d, 12)], C('#4a5568'));
    for (let j = 1; j < 4; j++) line(P(u, y + d, j * 3), P(u2, y + d, j * 3), 'rgba(255,255,255,.25)', 0.6);
  }
  box(x + w * 0.3, y + d * 0.3, 0.12, 0.12, 5, faces('#c9ccd2'), h);
  box(0.1, 0.9, 0.3, 0.07, 6, faces(['#d9534a', '#4a7fc7', '#d9a441', '#3a9d6e'][v % 4]));
}
function factory(k, v) {
  const { P, poly, box, faces, sh, C, line } = k;
  k.pad('#a9a493', ['#8a8574', '#bdb8a6']);
  sh(0.1, 0.12, 0.6, 0.66, 38);
  box(0.1, 0.12, 0.6, 0.66, 38, faces(['#b8856a', '#a87a62', '#b58f72', '#9c7160'][v % 4]));
  k.wins(0.1, 0.12, 0.6, 0.66, 38, v + 41, { dens: 2.6, rh: 10, wh: 5, base: 9 });
  poly([P(0.18, 0.78, 0), P(0.42, 0.78, 0), P(0.42, 0.78, 13), P(0.18, 0.78, 13)], C('#4a5568'));
  box(0.74, 0.14, 0.2, 0.2, 80, faces('#a2493a'));
  box(0.72, 0.12, 0.24, 0.24, 5, faces('#3a3a3a'), 76);
  sh(0.74, 0.14, 0.2, 0.2, 80);
  box(0.7, 0.5, 0.24, 0.3, 14, faces('#c9ccd2'));
  k.smoke(P(0.84, 0.24, 86), 3);
}
function plant(k, v) {
  const { P, poly, box, faces, sh, C, line, cyl } = k;
  k.pad('#a9a493', ['#8a8574', '#bdb8a6']);
  sh(0.08, 0.3, 0.52, 0.62, 46);
  box(0.08, 0.3, 0.52, 0.62, 46, faces(['#c9ccd2', '#c7c2b2', '#b8c2cc', '#d3d7de'][v % 4]));
  k.wins(0.08, 0.3, 0.52, 0.62, 46, v + 51, { dens: 2.4, rh: 12, wh: 5, base: 12 });
  poly([P(0.12, 0.92, 0), P(0.34, 0.92, 0), P(0.34, 0.92, 15), P(0.12, 0.92, 15)], C('#4a5568'));
  cyl(0.78, 0.55, 11, 44, '#d3d7de'); cyl(0.78, 0.86, 11, 34, '#c9a06a');
  line(P(0.78, 0.55, 44), P(0.78, 0.86, 34), C('#6b7280'), 1.6);
  box(0.1, 0.06, 0.22, 0.22, 96, faces('#a2493a')); box(0.08, 0.04, 0.26, 0.26, 5, faces('#3a3a3a'), 92);
  sh(0.1, 0.06, 0.22, 0.22, 96);
  k.smoke(P(0.21, 0.17, 102), 4);
}
function park(k, v) {
  const { P, poly, box, faces, sh, C, line, circ, ell, tree } = k;
  k.pad(v % 2 ? '#79c764' : '#70be5c', ['#4d8f3c', '#8fd070', '#3f7f34']);
  poly([P(0.42, 0.06), P(0.58, 0.06), P(0.58, 0.94), P(0.42, 0.94)], C('#d9cfae'), null, true);
  poly([P(0.06, 0.42), P(0.94, 0.42), P(0.94, 0.58), P(0.06, 0.58)], C('#d9cfae'), null, true);
  if (v === 0) {
    const p = P(0.5, 0.5);
    ell([p[0], p[1] + 1], 13, 6.5, C('#b9b194')); ell([p[0], p[1] - 1], 11, 5.5, C('#e4dcc0')); ell([p[0], p[1] - 2], 9, 4.5, C('#62b6e6'));
    line([p[0], p[1] - 3], [p[0], p[1] - 14], C('#bfe6fa'), 1.8);
  } else {
    const wd = { l: '#8a5a34', r: '#6b4426', t: '#a06a3c' };
    box(0.6, 0.62, 0.18, 0.07, 2.4, wd); box(0.6, 0.62, 0.18, 0.02, 3, wd, 2.4);
  }
  tree(0.2, 0.22, v % 2 ? 3 : 0, v + 1); tree(0.8, 0.2, 1, v + 2); tree(0.22, 0.8, v % 3 === 2 ? 2 : 0, v + 3); tree(0.82, 0.82, 3, v + 4);
  for (let i = 0; i < 6; i++) circ(P(0.3 + hash(v, i, 1) * 0.4, 0.3 + hash(v, i, 2) * 0.4), 1.4, C(['#e86f9b', '#f4c542', '#e04848', '#ffffff'][i % 4]));
}

const BUILD = {
  [T.RES]: [house, apartment, tower],
  [T.COM]: [shop, office, glassTower],
  [T.IND]: [warehouse, factory, plant],
};
const HEIGHTS = { [T.RES]: [100, 150, 230], [T.COM]: [110, 170, 250], [T.IND]: [110, 150, 220] };
const PAD = { [T.RES]: '#a9dc8e', [T.COM]: '#cfd1d4', [T.IND]: '#a9a493' };

function make(w, h, ox, oy, fn, mode, lit = true) {
  const c = mk(w, h), ctx = c.getContext('2d');
  ctx.scale(S, S);
  const k = kit(ctx, mode, ox, oy, lit);
  fn(k);
  return { c, ox, oy, S };
}
function memo(key, fn) { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; }

export function buildingSprite(kind, level, variant, mode, lit = true) {
  lit = mode === 2 ? !!lit : true;
  return memo(`b${kind}${level}${variant}${mode}${lit ? 1 : 0}`, () => {
    const H = HEIGHTS[kind][level - 1];
    return make(160, H, 80, H - 64, (k) => BUILD[kind][level - 1](k, variant), mode, lit);
  });
}
export function parkSprite(variant, mode) {
  return memo(`p${variant}${mode}`, () => make(96, 90, 48, 50, (k) => park(k, variant), mode));
}
export function zoneSprite(kind, mode) {
  return memo(`z${kind}${mode}`, () => make(64, 32, 32, 0, (k) => {
    const { P, path, ctx, C } = k;
    const col = tint(kind === T.RES ? '#4caf50' : kind === T.COM ? '#3d8bd9' : '#e0b526', mode);
    path([P(0.06, 0.06), P(0.94, 0.06), P(0.94, 0.94), P(0.06, 0.94)]);
    ctx.fillStyle = col + '55'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
  }, mode));
}
export function terrainSprite(type, variant, mode) {
  return memo(`t${type}${variant}${mode}`, () => make(64, 32, 32, 0, (k) => {
    const { P, ctx, C, line, poly } = k;
    if (type === TERRAIN.WATER) {
      poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], C(variant % 2 ? '#3f9ad2' : '#3894cc'), null, true);
      const g = ctx.createLinearGradient(0, 0, 64, 32); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,26,64,.22)');
      k.path([P(0, 0), P(1, 0), P(1, 1), P(0, 1)]); ctx.fillStyle = g; ctx.fill();
    } else if (type === TERRAIN.SAND) {
      poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], C(variant % 2 ? '#e8d9a4' : '#e1d19b'), null, true);
      for (let i = 0; i < 8; i++) { const p = P(hash(i, variant, 1), hash(i, variant, 2)); line(p, [p[0] + 1.5, p[1] - 1], C('#c9b87c'), 0.8); }
    } else {
      poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], C(['#a9dc8e', '#a1d685', '#9fd283', '#a6da8a'][variant % 4]), null, true);
      for (let i = 0; i < 9; i++) { const p = P(hash(i, variant, 1) * 0.9 + 0.05, hash(i, variant, 2) * 0.9 + 0.05); line(p, [p[0] + 1.8, p[1] - 1.4], C(['#4d8f3c', '#8fd070', '#3f7f34'][i % 3]), 0.9); }
    }
  }, mode));
}
export function treeSprite(variant, mode) {
  return memo(`tr${variant}${mode}`, () => make(64, 72, 32, 32, (k) => {
    const v = variant;
    k.tree(0.5, 0.5, v === 2 ? 1 : v === 3 ? 2 : v === 4 ? 3 : 0, v + 7);
    if (v % 2 === 0) k.tree(0.22, 0.7, 0, v + 9);
  }, mode));
}
export function roadSprite(mask, mode) {
  return memo(`r${mask}${mode}`, () => make(64, 32, 32, 0, (k) => {
    const { P, path, ctx, C, line, poly } = k;
    const hw = 0.36, a = 0.5 - hw, b = 0.5 + hw;
    poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], C('#c9c6bd'), null, true);
    const pieces = [[a, a, b, b]];
    if (mask & 1) pieces.push([a, 0, b, a]);
    if (mask & 2) pieces.push([b, a, 1, b]);
    if (mask & 4) pieces.push([a, b, b, 1]);
    if (mask & 8) pieces.push([0, a, a, b]);
    const q = (p) => [P(p[0], p[1]), P(p[2], p[1]), P(p[2], p[3]), P(p[0], p[3])];
    ctx.lineJoin = 'miter';
    for (const p of pieces) { path(q(p)); ctx.strokeStyle = C('#9a9ca2'); ctx.lineWidth = 2.4; ctx.stroke(); }
    for (const p of pieces) { path(q(p)); ctx.fillStyle = C('#50565f'); ctx.fill(); }
    for (let i = 0; i < 5; i++) { const pp = P(0.2 + hash(i, mask, 1) * 0.6, 0.2 + hash(i, mask, 2) * 0.6); k.circ(pp, 0.6, i % 2 ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.22)'); }
    const dash = C('#f0e08a'), c = P(0.5, 0.5), arms = (mask & 1 ? 1 : 0) + (mask & 2 ? 1 : 0) + (mask & 4 ? 1 : 0) + (mask & 8 ? 1 : 0);
    if (arms <= 2) {
      if (mask & 1) line(c, P(0.5, 0), dash, 1.1, [4, 3]);
      if (mask & 2) line(c, P(1, 0.5), dash, 1.1, [4, 3]);
      if (mask & 4) line(c, P(0.5, 1), dash, 1.1, [4, 3]);
      if (mask & 8) line(c, P(0, 0.5), dash, 1.1, [4, 3]);
    } else {
      const zb = C('#f1f1ec');
      const bars = (x0, y0, x1, y1, alongX) => { for (let i = 0; i < 5; i++) { const t = 0.18 + i * 0.16; const A = alongX ? [x0, y0 + (y1 - y0) * t] : [x0 + (x1 - x0) * t, y0]; const B = alongX ? [x1, A[1]] : [A[0], y1]; line(P(A[0], A[1]), P(B[0], B[1]), zb, 0.8); } };
      if (mask & 1) bars(a + 0.02, 0.05, b - 0.02, 0.12, false);
      if (mask & 4) bars(a + 0.02, 0.88, b - 0.02, 0.95, false);
      if (mask & 2) bars(0.88, a + 0.02, 0.95, b - 0.02, true);
      if (mask & 8) bars(0.05, a + 0.02, 0.12, b - 0.02, true);
    }
  }, mode));
}
export function clearSprites() { cache.clear(); }

// ---------------- utilities and services ----------------
function padRect(k, w, d, col, speck) {
  const { P, poly, C, line } = k;
  poly([P(0, 0), P(w, 0), P(w, d), P(0, d)], C(col), null, true);
  if (speck) for (let i = 0; i < 14 * w * d; i++) { const p = P(hash(i, 1, 4) * (w - 0.1) + 0.05, hash(i, 2, 5) * (d - 0.1) + 0.05); line(p, [p[0] + 1.8, p[1] - 1.4], C(speck[i % speck.length]), 0.9); }
}
function coalPlant(k) {
  const { P, poly, box, faces, sh, C, line, cyl, ell, ctx } = k;
  padRect(k, 2, 2, '#a9a493', ['#8a8574', '#bdb8a6']);
  sh(0.15, 0.9, 1.1, 0.9, 44);
  box(0.15, 0.9, 1.1, 0.9, 44, faces('#b7bcc4'));
  k.wins(0.15, 0.9, 1.1, 0.9, 44, 61, { dens: 3, rh: 12, wh: 5, base: 14 });
  poly([P(0.25, 1.8, 0), P(0.6, 1.8, 0), P(0.6, 1.8, 15), P(0.25, 1.8, 15)], C('#4a5568'));
  // conveyor + coal pile
  for (let i = 0; i < 6; i++) line(P(1.3 + i * 0.1, 1.35, 6 + i * 4), P(1.3 + i * 0.1, 1.5, 6 + i * 4), C('#555b66'), 1.5);
  ell(P(1.6, 1.62, 3), 20, 9, C('#2a2c31')); ell(P(1.6, 1.62, 8), 12, 6, C('#33363c'));
  // cooling towers
  sh(1.25, 0.15, 0.6, 0.6, 70);
  cyl(1.55, 0.45, 20, 66, '#d8dce2'); cyl(1.55, 0.45, 20, 4, '#9aa0a8', 62);
  k.smoke(P(1.55, 0.45, 70), 3);
  // chimney with red/white bands
  box(0.35, 0.2, 0.2, 0.2, 118, faces('#e6e6e6'));
  for (let z = 14; z < 118; z += 28) box(0.35, 0.2, 0.2, 0.2, 12, faces('#c9372c'), z);
  sh(0.35, 0.2, 0.2, 0.2, 118);
  box(0.33, 0.18, 0.24, 0.24, 5, faces('#3a3a3a'), 114);
  k.smoke(P(0.45, 0.3, 122), 4);
  // fence
  for (let i = 0; i <= 8; i++) { const u = i / 4; line(P(u, 1.97), P(u, 1.97, 6), C('#6b7280'), 0.7); line(P(1.97, u), P(1.97, u, 6), C('#6b7280'), 0.7); }
  line(P(0, 1.97, 6), P(2, 1.97, 6), C('#6b7280'), 0.8); line(P(1.97, 0, 6), P(1.97, 2, 6), C('#6b7280'), 0.8);
}
function wind(k) {
  const { P, circ, cyl, box, faces, sh, C, ell } = k;
  k.pad('#a9dc8e', ['#4d8f3c', '#8fd070']);
  cyl(0.5, 0.5, 3.4, 72, '#eef1f4');
  box(0.43, 0.43, 0.14, 0.14, 7, faces('#d3d7de'), 70);
  const p = P(0.5, 0.5, 74); circ(p, 3, C('#cfd4da'));
}
function waterTower(k) {
  const { P, poly, box, faces, sh, C, line, cyl, ell } = k;
  k.pad('#b9d9a0', ['#4d8f3c', '#8fd070']);
  sh(0.25, 0.25, 0.5, 0.5, 66);
  for (const [x, y] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) line(P(x, y), P(0.5 + (x - 0.5) * 0.7, 0.5 + (y - 0.5) * 0.7, 42), C('#6b7280'), 1.8);
  line(P(0.3, 0.7, 14), P(0.7, 0.7, 14), C('#6b7280'), 1); line(P(0.7, 0.3, 14), P(0.7, 0.7, 14), C('#6b7280'), 1);
  cyl(0.5, 0.5, 15, 22, '#cfd6de', 42);
  cyl(0.5, 0.5, 15.4, 5, '#3d8bd9', 52);
  const t = P(0.5, 0.5, 64), b = P(0.5, 0.5, 64);
  k.ctx.beginPath(); k.ctx.moveTo(t[0] - 15, t[1]); k.ctx.lineTo(t[0], t[1] - 12); k.ctx.lineTo(t[0] + 15, t[1]); k.ctx.closePath(); k.ctx.fillStyle = C('#8f98a6'); k.ctx.fill();
  k.ctx.beginPath(); k.ctx.moveTo(t[0] - 15, t[1]); k.ctx.lineTo(t[0], t[1] - 12); k.ctx.lineTo(t[0], t[1]); k.ctx.closePath(); k.ctx.fillStyle = C('#a4acb8'); k.ctx.fill();
}
function police(k) {
  const { P, poly, box, faces, sh, C, line, circ } = k;
  k.pad('#cfd1d4', null);
  const x = 0.1, y = 0.12, w = 0.8, d = 0.7, h = 32;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#dfe6f0', r: shade('#dfe6f0', 0.76), t: '#a3a9b3' });
  poly([P(x, y + d, 18), P(x + w, y + d, 18), P(x + w, y + d, 23), P(x, y + d, 23)], C('#2f5fb0'));
  k.wins(x, y, w, d, h, 71, { dens: 3, rh: 9, wh: 5, base: 5 });
  poly([P(x + 0.32, y + d, 0), P(x + 0.5, y + d, 0), P(x + 0.5, y + d, 11), P(x + 0.32, y + d, 11)], C('#35566b'));
  box(x + 0.3, y + 0.25, 0.28, 0.14, 4, faces('#8b929c'), h);
  const lb = P(x + 0.44, y + 0.32, h + 6); circ([lb[0] - 3, lb[1]], 2.4, '#e0483f'); circ([lb[0] + 3, lb[1]], 2.4, '#3a7bd5');
  box(x + 0.05, 0.9, 0.3, 0.1, 5, faces('#f2f2f2')); box(x + 0.05, 0.9, 0.3, 0.1, 2, faces('#2f5fb0'), 1);
}
function fireStation(k) {
  const { P, poly, box, faces, sh, C, line } = k;
  k.pad('#cfd1d4', null);
  const x = 0.1, y = 0.12, w = 0.8, d = 0.7, h = 30;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#cf4b3f', r: shade('#cf4b3f', 0.76), t: '#a3a9b3' });
  poly([P(x, y + d, 20), P(x + w, y + d, 20), P(x + w, y + d, 23), P(x, y + d, 23)], C('#f2f2f2'));
  for (const [a, b] of [[0.06, 0.34], [0.42, 0.7]]) {
    poly([P(x + a, y + d, 0), P(x + b, y + d, 0), P(x + b, y + d, 17), P(x + a, y + d, 17)], C('#e9ecf0'));
    for (let z = 3; z < 17; z += 3) line(P(x + a, y + d, z), P(x + b, y + d, z), 'rgba(0,0,0,.2)', 0.6);
  }
  k.wins(x, y, w, d, h, 72, { dens: 2, rh: 9, wh: 5, base: 22 });
  box(0.72, 0.15, 0.16, 0.16, 54, faces('#cf4b3f')); box(0.7, 0.13, 0.2, 0.2, 5, faces('#8b929c'), 54);
  poly([P(0.75, 0.31, 36), P(0.85, 0.31, 36), P(0.85, 0.31, 46), P(0.75, 0.31, 46)], C('#f4c542'));
}
function clinic(k) {
  const { P, poly, box, faces, sh, C, line } = k;
  k.pad('#cfd1d4', null);
  const x = 0.1, y = 0.1, w = 0.8, d = 0.76, h = 46;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#f0f3f6', r: shade('#f0f3f6', 0.78), t: '#a3a9b3' });
  k.wins(x, y, w, d, h, 73, { dens: 3.2, rh: 10, wh: 5.5, base: 14 });
  poly([P(x + 0.3, y + d, 0), P(x + 0.52, y + d, 0), P(x + 0.52, y + d, 11), P(x + 0.3, y + d, 11)], C('#35566b'));
  poly([P(x + 0.24, y + d, 11), P(x + 0.58, y + d, 11), P(x + 0.58, y + d + 0.12, 8), P(x + 0.24, y + d + 0.12, 8)], C('#e0483f'));
  const cx = x + w - 0.16;
  poly([P(cx - 0.05, y + d, 26), P(cx + 0.05, y + d, 26), P(cx + 0.05, y + d, 40), P(cx - 0.05, y + d, 40)], C('#e0483f'));
  poly([P(cx - 0.12, y + d, 31), P(cx + 0.12, y + d, 31), P(cx + 0.12, y + d, 35), P(cx - 0.12, y + d, 35)], C('#e0483f'));
  box(x + 0.15, y + 0.15, 0.26, 0.22, 5, faces('#9aa0a8'), h);
  box(x + 0.06, 0.92, 0.3, 0.1, 5, faces('#f7f7f7')); box(x + 0.06, 0.92, 0.3, 0.1, 1.6, faces('#e0483f'), 2);
}
function school(k) {
  const { P, poly, box, faces, sh, C, line, circ, tree } = k;
  k.pad('#b9d9a0', ['#4d8f3c', '#8fd070']);
  const brick = '#c78b6a';
  sh(0.1, 0.1, 0.82, 0.38, 28);
  box(0.1, 0.1, 0.82, 0.38, 28, faces(brick));
  k.wins(0.1, 0.1, 0.82, 0.38, 28, 74, { dens: 4, rh: 12, wh: 6, base: 6 });
  box(0.1, 0.48, 0.34, 0.3, 26, faces('#cf9a7a'));
  k.wins(0.1, 0.48, 0.34, 0.3, 26, 75, { dens: 3, rh: 12, wh: 6, base: 6 });
  poly([P(0.2, 0.78, 0), P(0.34, 0.78, 0), P(0.34, 0.78, 12), P(0.2, 0.78, 12)], C('#6b4430'));
  box(0.38, 0.12, 0.16, 0.16, 54, faces('#d9a58a'));
  poly([P(0.38, 0.28, 40), P(0.54, 0.28, 40), P(0.54, 0.28, 50), P(0.38, 0.28, 50)], C('#f2f2f2'));
  const t = P(0.46, 0.2, 54), t2 = P(0.46, 0.2, 66);
  k.ctx.beginPath(); k.ctx.moveTo(P(0.36, 0.3, 54)[0], P(0.36, 0.3, 54)[1]); k.ctx.lineTo(t2[0], t2[1]); k.ctx.lineTo(P(0.56, 0.3, 54)[0], P(0.56, 0.3, 54)[1]); k.ctx.closePath(); k.ctx.fillStyle = C('#8d4b3c'); k.ctx.fill();
  const fp = P(0.84, 0.62); line(fp, [fp[0], fp[1] - 34], C('#8b8f96'), 1.2); poly([[fp[0], fp[1] - 34], [fp[0] + 9, fp[1] - 31], [fp[0], fp[1] - 27]], C('#e0483f'), null, true);
  for (const [a, b, c] of [[0.62, 0.7, '#e0483f'], [0.72, 0.78, '#f4c542'], [0.5, 0.88, '#3a7bd5']]) circ(P(a, b, 2), 2.2, C(c));
  tree(0.12, 0.9, 0, 5);
}
const SVC_SPR = { 1: [coalPlant, 2, 2, 190], 2: [wind, 1, 1, 130], 3: [waterTower, 1, 1, 130], 4: [police, 1, 1, 100], 5: [fireStation, 1, 1, 130], 6: [clinic, 1, 1, 110], 7: [school, 1, 1, 130] };
export function serviceSprite(id, mode, lit = true) {
  lit = mode === 2 ? !!lit : true;
  return memo(`s${id}${mode}${lit ? 1 : 0}`, () => {
    const [fn, fw, fd, hh] = SVC_SPR[id];
    const W = (fw + fd) * 32 + 96, ox = fd * 32 + 32, H = hh + (fw + fd) * 16 + 34, oy = H - (fw + fd) * 16 - 34;
    return make(W, H, ox, oy, (k) => fn(k), mode, lit);
  });
}
