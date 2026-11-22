import { tint, shade, mix, hash, lerp } from './util.js';
import { T, TERRAIN } from './world.js';
import { waterfrontArt, WF_HEIGHTS } from './waterfront.js';

const S = 2;               // supersampling for crisp zoom
const cache = new Map();
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w * S; c.height = h * S; return c; };

function kit(ctx, mode, ox, oy, lit = true, season = 0) {
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
    if (h > 3) {
      line(P(x, y + d, t), P(x + w, y + d, t), 'rgba(255,255,255,.35)', 0.6);                       // sunlit parapet edge
      line(P(x + w, y, t), P(x + w, y + d, t), 'rgba(255,255,255,.18)', 0.6);
      if (z0 === 0) {                                                                               // ambient occlusion at the ground
        const ao = (a2) => { const g = ctx.createLinearGradient(0, a2[0][1], 0, a2[0][1] - Math.min(10, h * 0.4)); g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); return g; };
        const fl = [P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, Math.min(10, h * 0.4)), P(x, y + d, Math.min(10, h * 0.4))];
        const fr = [P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, Math.min(10, h * 0.4)), P(x + w, y, Math.min(10, h * 0.4))];
        path(fl); ctx.fillStyle = ao([P(x, y + d, 0)]); ctx.fill(); path(fr); ctx.fillStyle = ao([P(x + w, y + d, 0)]); ctx.fill();
      }
    }
  };
  // Soft, blurred shadows: a dark contact shadow hugging the footprint, then a longer cast shadow away from the sun.
  // Sprites are cached, so the blur costs nothing per frame.
  const sh = (x, y, w, d, h) => {
    ctx.save(); ctx.filter = 'blur(2.2px)';
    ctx.fillStyle = `rgba(0,0,0,${mode === 2 ? 0.3 : 0.24})`;
    path([P(x - 0.06, y - 0.06), P(x + w + 0.08, y - 0.06), P(x + w + 0.08, y + d + 0.08), P(x - 0.06, y + d + 0.08)]); ctx.fill();
    if (mode !== 2) {
      const s = Math.min(1.9, (h / 62) * (mode === 1 ? 1.8 : 1)), o = mode === 1 ? 0.22 : 0.17;
      ctx.filter = `blur(${1.6 + s * 1.4}px)`;
      ctx.fillStyle = `rgba(16,28,52,${o})`;
      path([P(x + w, y), P(x + w + s, y + s * 0.22), P(x + w + s, y + d + s * 0.22), P(x + w, y + d)]); ctx.fill();
      ctx.fillStyle = `rgba(16,28,52,${o * 0.7})`;
      path([P(x + w, y), P(x + w + s * 0.45, y + s * 0.1), P(x + w + s * 0.45, y + d + s * 0.1), P(x + w, y + d)]); ctx.fill();
    }
    ctx.restore();
  };
  const win = (a, r, side, gl) => {
    const top = Math.min(a[0][1], a[1][1], a[2][1], a[3][1]), bot = Math.max(a[0][1], a[1][1], a[2][1], a[3][1]);
    path(a);
    if (mode === 2) {
      const on = lit && r > 0.45;
      if (on) { const warm = r > 0.93 ? '#cfe3ff' : r > 0.62 ? '#ffd98c' : '#ffc36b'; ctx.fillStyle = side ? shade(warm, 0.86) : warm; }   // a few cool TV-lit rooms
      else ctx.fillStyle = side ? '#18264a' : '#1f2f5a';
      ctx.fill();
      if (on && r < 0.8) { path(a); ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(120,70,30,.35)'; ctx.fillRect(0, top, 400, (bot - top) * 0.35); ctx.restore(); }  // curtain
      return;
    }
    const g = ctx.createLinearGradient(0, top, 0, bot);                    // sky reflected in the glass
    const hi = gl ? '#e4f4fd' : '#cfe8f7', lo = gl ? (side ? '#6f9fc0' : '#8db8d6') : (side ? '#5f86a6' : '#7fa7c6');
    g.addColorStop(0, mode === 1 ? mix(hi, '#ffd2a0', 0.5) : hi); g.addColorStop(1, mode === 1 ? mix(lo, '#d98a5a', 0.4) : lo);
    ctx.fillStyle = g; ctx.fill();
    if (!gl && r > 0.7) { ctx.save(); path(a); ctx.clip(); ctx.fillStyle = r > 0.85 ? 'rgba(240,232,214,.85)' : 'rgba(250,250,245,.7)'; ctx.fillRect(0, top, 400, (bot - top) * (0.25 + (r - 0.7) * 2)); ctx.restore(); }   // blinds
    else if (!gl && r < 0.12) { path(a); ctx.fillStyle = 'rgba(30,45,70,.45)'; ctx.fill(); }      // an open, dark window
    path(a); ctx.strokeStyle = gl ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)'; ctx.lineWidth = gl ? 0.4 : 0.7; ctx.stroke();
    if (!gl) { const m0 = [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2], m1 = [(a[2][0] + a[3][0]) / 2, (a[2][1] + a[3][1]) / 2]; ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.4; ctx.stroke(); }   // mullion
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
        ctx.beginPath(); ctx.moveTo(cx - hw, by); ctx.lineTo(cx + hw, by); ctx.lineTo(cx, by - 11); ctx.closePath(); ctx.fillStyle = C('#245f38'); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - hw, by); ctx.lineTo(cx, by); ctx.lineTo(cx, by - 11); ctx.closePath(); ctx.fillStyle = C('#3a8c53'); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - hw, by); ctx.lineTo(cx - hw * 0.4, by + 1.2); ctx.lineTo(cx + hw * 0.4, by + 1.2); ctx.lineTo(cx + hw, by); ctx.closePath(); ctx.fillStyle = C('#1d4d2e'); ctx.fill();   // drooping skirt of needles
        if (season === 2) { ctx.beginPath(); ctx.moveTo(cx - hw * 0.55, by - 4); ctx.lineTo(cx, by - 11); ctx.lineTo(cx + hw * 0.55, by - 4); ctx.lineTo(cx, by - 6.5); ctx.closePath(); ctx.fillStyle = C('#f2f6f9'); ctx.fill(); }   // snow on the branches
      }
    } else {
      if (season === 2) {                                       // winter: bare branches with a little snow on them
        ctx.strokeStyle = C('#6a4a33'); ctx.lineWidth = 1.1; ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (hash(sd, i, 7) - 0.5) * 1.9, L2 = r * (0.8 + hash(sd, i, 8) * 0.7), bx = cx + Math.cos(a) * L2, by = cy - 8 + Math.sin(a) * L2 * 1.3; ctx.moveTo(cx, cy - 7); ctx.lineTo(bx, by); ctx.moveTo(bx, by); ctx.lineTo(bx + (hash(sd, i, 9) - 0.5) * 5, by - 3); }
        ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (hash(sd, i, 7) - 0.5) * 1.9, L2 = r * (0.8 + hash(sd, i, 8) * 0.7); circ([cx + Math.cos(a) * L2, cy - 8 + Math.sin(a) * L2 * 1.3 - 0.6], 1.1, C('#f4f8fb')); }
        return;
      }
      const AUT = [['#c26a22', '#e08a2e', '#f2b04a'], ['#b8442c', '#d8603a', '#ee8a4e'], ['#c99a2a', '#e2b83c', '#f4d35e'], ['#8f8a2c', '#b5ac3c', '#d6c95a']];
      const pal = season === 1 ? (k === 2 ? AUT[1] : AUT[Math.floor(hash(sd, 9, 9) * 4)]) : k === 2 ? ['#c26a22', '#e08a2e', '#f2b04a'] : k === 3 ? ['#4d9a45', '#6cba58', '#92d878'] : ['#3b8636', '#56a845', '#79c85f'];
      const hue = 0.92 + hash(sd, 4, 4) * 0.16;                       // every tree a slightly different green
      const blob = (bx, by, br, base) => {
        const gr = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br * 1.05);
        gr.addColorStop(0, C(shade(base, 1.22 * hue))); gr.addColorStop(0.55, C(shade(base, hue))); gr.addColorStop(1, C(shade(base, 0.68 * hue)));
        ctx.beginPath(); ctx.arc(bx, by, br, 0, 6.2832); ctx.fillStyle = gr; ctx.fill();
      };
      ctx.strokeStyle = C('#5a3d26'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + r * 0.35, cy - 8 - r * 0.6); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx - r * 0.3, cy - 8 - r * 0.7); ctx.stroke();
      blob(cx + r * 0.3, cy - 8 - r * 0.45, r * 0.72, shade(pal[0], 0.85));
      blob(cx - r * 0.25, cy - 8 - r * 0.55, r * 0.75, pal[0]);
      blob(cx, cy - 8 - r * 0.85, r * 0.85, pal[1]);
      blob(cx - r * 0.2, cy - 8 - r * 1.15, r * 0.5, pal[2]);
      for (let i = 0; i < 7; i++) circ([cx - r * 0.6 + hash(sd, i, 5) * r * 1.2, cy - 8 - r * 0.3 - hash(sd, i, 6) * r * 1.1], 0.9, C(i % 2 ? shade(pal[2], 1.15) : shade(pal[0], 0.7)));   // leaf texture
    }
  };
  const pad = (col, speck) => {
    poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], C(col), null, true);
    if (speck) for (let i = 0; i < 9; i++) { const p = P(hash(i, 1, 4) * 0.9 + 0.05, hash(i, 2, 5) * 0.9 + 0.05); line(p, [p[0] + 1.8, p[1] - 1.4], C(speck[i % speck.length]), 0.9); }
  };
  const smoke = () => {};   // smoke is animated at draw time (see smoke.js)
  const store = () => C(mode === 2 && lit ? '#ffd98c' : '#35566b');
  return { C, P, path, poly, line, circ, ell, faces, box, sh, win, wins, cyl, tree, pad, smoke, ctx, mode, lit, store };
}

const WALL = ['#f2e6cd', '#e8cdb5', '#d9e6ef', '#f5dca8', '#e9d9ee'];
const ROOF = ['#c4553a', '#8d4b3c', '#566a8c', '#a9473b', '#6f5a8d'];
const MID = ['#d9c7a5', '#c98a72', '#9db3c8', '#b9c9a0'];
const COOL = ['#aab6c4', '#c9b8a6', '#9fb0a0', '#b7a9c4'];
const GLASS = ['#6db6de', '#7aa7d6', '#68bfc0', '#8aa4c8'];
const AWN = ['#c0392b', '#2e86c1', '#27ae60', '#e67e22', '#8e44ad'];

// ---- extra detail: buildings that grow now pick from 8 variants instead of 4; variants 4..7 add these ----
// A flat roof gets solar panels, a roof garden, a water tank or plant and vents, so neighbouring roofs differ.
function roofDress(k, x, y, w, d, h, v) {
  const { P, poly, box, faces, C, line, cyl, circ } = k, pick = (v + Math.floor(hash(v, 3, 31) * 4)) % 4;
  const ix = x + 0.07, iy = y + 0.07, iw = w - 0.14, id = d - 0.14;
  if (pick === 0) {                                          // rows of tilted solar panels
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const px = ix + i * iw / 3, py = iy + j * id / 2, pw = iw / 3 - 0.04, pd = id / 2 - 0.06;
      poly([P(px, py, h + 1), P(px + pw, py, h + 1), P(px + pw, py + pd, h + 4), P(px, py + pd, h + 4)], C('#2b4a78'));
      line(P(px + pw / 2, py, h + 1), P(px + pw / 2, py + pd, h + 4), 'rgba(160,200,240,.5)', 0.4);
    }
  } else if (pick === 1) {                                   // roof garden with planters and a parasol
    poly([P(ix, iy, h + 1), P(ix + iw, iy, h + 1), P(ix + iw, iy + id, h + 1), P(ix, iy + id, h + 1)], C('#8fbf6a'));
    poly([P(ix + iw * 0.35, iy, h + 1.2), P(ix + iw * 0.5, iy, h + 1.2), P(ix + iw * 0.5, iy + id, h + 1.2), P(ix + iw * 0.35, iy + id, h + 1.2)], C('#cdbb98'), null, true);
    for (let i = 0; i < 6; i++) circ(P(ix + 0.06 + hash(v, i, 32) * (iw - 0.12), iy + 0.06 + hash(v, i, 33) * (id - 0.12), h + 4), 2.2 + hash(v, i, 34) * 1.4, C(i % 2 ? '#4f9a46' : '#6cba58'));
    const pp = P(ix + iw * 0.75, iy + id * 0.3, h + 1); line(pp, [pp[0], pp[1] - 9], C('#777'), 0.7); k.ell([pp[0], pp[1] - 9], 5, 2.2, C(AWN[v % 5]));
  } else if (pick === 2) {                                   // water tank on legs and two air-conditioning units
    const tx = ix + iw * 0.7, ty = iy + id * 0.3;
    for (const [a, b] of [[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]]) line(P(tx + a, ty + b, h), P(tx + a, ty + b, h + 7), C('#5d5146'), 0.8);
    cyl(tx, ty, 4.5, 9, '#8b6b4a', h + 7);
    box(ix + 0.04, iy + id - 0.2, 0.14, 0.12, 4, faces('#b8bdc4'), h); box(ix + 0.22, iy + id - 0.2, 0.14, 0.12, 4, faces('#b8bdc4'), h);
    circ(P(ix + 0.11, iy + id - 0.14, h + 4), 1.4, C('#7d838b')); circ(P(ix + 0.29, iy + id - 0.14, h + 4), 1.4, C('#7d838b'));
  } else {                                                   // plant room, vent pipes and an antenna
    box(ix + 0.05, iy + 0.05, iw * 0.4, id * 0.45, 7, faces('#a9aeb6'), h);
    for (let i = 0; i < 3; i++) cyl(ix + iw * (0.6 + i * 0.12), iy + id * 0.7, 1.4, 5, '#8d939b', h);
    const a = P(ix + iw * 0.8, iy + id * 0.25, h); line(a, [a[0], a[1] - 16], C('#9aa3ad'), 0.8); line([a[0] - 3, a[1] - 12], [a[0] + 3, a[1] - 12], C('#9aa3ad'), 0.7);
  }
}
// balconies with railings on the front wall, some with laundry drying
function balconies(k, x, y, w, d, h, v) {
  const { P, box, faces, line, C } = k, cl = ['#f4f4f0', '#e86f6f', '#6fa8e8', '#f4d35e', '#8fd07a'];
  for (let z = 15, f = 0; z < h - 6; z += 10, f++) for (const u of [0.12, 0.5]) {
    if (hash(v, f, u * 10) < 0.25) continue;
    box(x + u, y + d, 0.2, 0.07, 1.2, faces('#d6d8dc'), z);
    line(P(x + u, y + d + 0.07, z + 4), P(x + u + 0.2, y + d + 0.07, z + 4), C('#8d939b'), 0.6);
    if (hash(v, f, u * 10 + 5) > 0.6) {                    // a washing line
      line(P(x + u + 0.02, y + d + 0.03, z + 6.5), P(x + u + 0.18, y + d + 0.03, z + 6.5), C('#cfcfcf'), 0.4);
      for (let j = 0; j < 3; j++) { const p = P(x + u + 0.04 + j * 0.05, y + d + 0.03, z + 6.4); k.ctx.fillStyle = C(cl[(f + j + v) % 5]); k.ctx.fillRect(p[0] - 0.9, p[1], 1.8, 2.4); }
    }
  }
}
// small things on the ground in front of a house: a hedge, a picket fence, sometimes a car in the drive
function yard(k, v) {
  const { P, box, faces, line, C, circ } = k;
  for (let i = 0; i < 7; i++) circ(P(0.06 + i * 0.055, 0.95, 2), 2, C(i % 2 ? '#3f7f34' : '#4d8f3c'));
  for (let u = 0.72; u <= 0.96; u += 0.06) line(P(u, 0.97), P(u, 0.97, 5), C('#f4f2ec'), 0.8);
  line(P(0.72, 0.97, 3.5), P(0.96, 0.97, 3.5), C('#f4f2ec'), 0.7);
  if (v % 2 === 0) { const c = AWN[(v * 3) % 5]; box(0.52, 0.7, 0.14, 0.24, 4, faces(c)); box(0.54, 0.76, 0.1, 0.12, 2.5, faces('#2c3440'), 4); }
  box(0.04, 0.6, 0.04, 0.04, 6, faces('#3d6fb0'));           // mailbox
}

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
  if (v >= 4) yard(k, v);
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
  if (v >= 4) { roofDress(k, x, y, w, d, h, v); balconies(k, x, y, w, d, h, v); return; }
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
  if (v >= 4) {                                              // a rooftop sign on two posts, and bins by the side wall
    roofDress(k, x, y, w, d * 0.6, h, v + 1);
    const c = AWN[(v + 3) % 5]; for (const u of [0.3, 0.6]) line(P(x + u, y + d - 0.1, h), P(x + u, y + d - 0.1, h + 8), C('#6b7280'), 0.9);
    box(x + 0.22, y + d - 0.12, 0.46, 0.04, 8, faces(c), h + 6); for (let i = 0; i < 3; i++) line(P(x + 0.27 + i * 0.12, y + d - 0.08, h + 10), P(x + 0.35 + i * 0.12, y + d - 0.08, h + 10), 'rgba(255,255,255,.85)', 1.2);
    box(x + w + 0.01, y + 0.1, 0.06, 0.06, 5, faces('#3f8f5a')); box(x + w + 0.01, y + 0.2, 0.06, 0.06, 5, faces('#5a6270'));
    return;
  }
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
  if (v >= 4) { roofDress(k, x, y, w, d, h, v + 2); return; }
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
  k.pad(gtint(v % 2 ? '#79c764' : '#70be5c'), ['#4d8f3c', '#8fd070', '#3f7f34'].map(gtint));
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

// ---- level 4: skyscrapers, office megatowers and hi-tech campuses ----
function skyscraper(k, v) {
  const { P, poly, box, faces, sh, C, line, circ } = k;
  const base = ['#d8d2c4', '#c9d3dc', '#e2d3c3', '#cfd6cf'][v % 4], accent = ['#3f6f8f', '#8d4b3c', '#4c7a5a', '#6f5a8d'][v % 4];
  const x = 0.16, y = 0.16, w = 0.68, d = 0.68, h = 150, f = faces(base);
  k.pad('#b9d9a0', ['#4d8f3c', '#8fd070']);
  sh(x, y, w, d, h + 30);
  box(x - 0.04, y - 0.04, w + 0.08, d + 0.08, 14, faces('#b9b4aa'));                 // podium with lobby
  poly([P(x + 0.06, y + d + 0.04, 1), P(x + w - 0.06, y + d + 0.04, 1), P(x + w - 0.06, y + d + 0.04, 11), P(x + 0.06, y + d + 0.04, 11)], k.store());
  box(x, y, w, d, h, f, 14);
  k.wins(x, y, w, d, h + 14, v + 61, { dens: 3.8, rh: 8, wh: 4.6, base: 20 });
  for (let z = 26; z < h + 10; z += 16) {                                              // balcony bands
    poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d + 0.05, z - 1.5), P(x, y + d + 0.05, z - 1.5)], C(shade(base, 1.12)));
    poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w + 0.05, y + d, z - 1.5), P(x + w + 0.05, y, z - 1.5)], C(shade(base, 0.9)));
  }
  poly([P(x + w * 0.42, y + d, 14), P(x + w * 0.58, y + d, 14), P(x + w * 0.58, y + d, h + 14), P(x + w * 0.42, y + d, h + 14)], C(accent));
  box(x + 0.06, y + 0.06, w - 0.12, d - 0.12, 4, faces('#7fb069'), h + 14);           // rooftop garden
  for (let i = 0; i < 4; i++) circ(P(x + 0.15 + (i % 2) * 0.3, y + 0.15 + (i >> 1) * 0.3, h + 22), 3.2, C(['#3f8f3a', '#56a845'][i % 2]));
  box(x + w * 0.62, y + 0.1, 0.14, 0.14, 12, faces('#9aa0a8'), h + 18);
  const p = P(x + w * 0.69, y + 0.17, h + 30); line(p, [p[0], p[1] - 16], C('#c9d3de'), 1.1); circ([p[0], p[1] - 17], 1.8, '#ff3b30');
}
function megatower(k, v) {
  const { P, poly, box, faces, sh, C, line, circ } = k;
  const g = ['#5aa3d8', '#4f8fc9', '#5fb5b8', '#7a95c6'][v % 4], f = faces(g);
  const tiers = [[0.08, 70], [0.15, 60], [0.22, 46], [0.29, 26]];
  k.pad('#c8cace', null);
  sh(0.08, 0.08, 0.84, 0.84, 220);
  let z = 0;
  for (const [o, h] of tiers) {
    const x = o, y = o, w = 1 - 2 * o, d = 1 - 2 * o;
    box(x, y, w, d, h, f, z);
    poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], 'rgba(0,0,0,0)', 'glass', true);
    poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], 'rgba(0,0,0,0)', 'glass', true);
    k.wins(x, y, w, d, h, v + 71 + z, { dens: 4.8, rh: 7, wh: 3.8, base: z === 0 ? 14 : 4, glass: 1 });
    for (let u = 1; u < 5; u++) { const q = x + (w * u) / 5; line(P(q, y + d, z), P(q, y + d, z + h), 'rgba(255,255,255,.35)', 0.6); }
    z += h;
    if (o < 0.29) box(x + 0.02, y + 0.02, w - 0.04, d - 0.04, 3, faces('#d7dde4'), z);
    z += 3;
  }
  poly([P(0.15, 0.92, 1), P(0.85, 0.92, 1), P(0.85, 0.92, 12), P(0.15, 0.92, 12)], k.store());
  const top = P(0.5, 0.5, z); poly([[top[0] - 6, top[1]], [top[0] + 6, top[1]], [top[0], top[1] - 30]], C('#dfe6ee'));
  line([top[0], top[1] - 30], [top[0], top[1] - 48], C('#c9d3de'), 1.2); circ([top[0], top[1] - 49], 2.2, '#ff3b30');
}
function campus(k, v) {
  const { P, poly, box, faces, sh, C, line, circ, tree } = k;
  const wall = ['#e9edf1', '#dfe7ea', '#eef0ec', '#e4e8f0'][v % 4], gl = GLASS[v % 4];
  k.pad('#9fd283', ['#4d8f3c', '#8fd070', '#3f7f34']);
  poly([P(0.05, 0.62), P(0.95, 0.62), P(0.95, 0.74), P(0.05, 0.74)], C('#c9ccd2'), null, true);   // walkway
  sh(0.08, 0.1, 0.5, 0.48, 40);
  box(0.08, 0.1, 0.5, 0.48, 40, faces(wall));
  poly([P(0.08, 0.58, 4), P(0.58, 0.58, 4), P(0.58, 0.58, 36), P(0.08, 0.58, 36)], C(gl), 'glass');
  k.wins(0.08, 0.1, 0.5, 0.48, 40, v + 81, { dens: 3, rh: 9, wh: 6, base: 6, glass: 1 });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {                                    // solar panels
    const x0 = 0.12 + i * 0.15, y0 = 0.14 + j * 0.2;
    poly([P(x0, y0, 41), P(x0 + 0.12, y0, 41), P(x0 + 0.12, y0 + 0.16, 46), P(x0, y0 + 0.16, 46)], C('#2c4a7a'));
    line(P(x0 + 0.06, y0, 41), P(x0 + 0.06, y0 + 0.16, 46), 'rgba(180,210,255,.6)', 0.5);
  }
  sh(0.64, 0.12, 0.3, 0.42, 26);
  box(0.64, 0.12, 0.3, 0.42, 26, faces(shade(wall, 0.95)));
  box(0.66, 0.14, 0.26, 0.38, 3, faces('#7fb069'), 26);                                     // green roof
  k.wins(0.64, 0.12, 0.3, 0.42, 26, v + 91, { dens: 3, rh: 9, wh: 5, base: 6, glass: 1 });
  const p = P(0.79, 0.3, 30); line(p, [p[0], p[1] - 14], C('#c9d3de'), 1); circ([p[0], p[1] - 15], 3, C('#e6ecf2'));
  tree(0.14, 0.86, 3, v + 5); tree(0.86, 0.86, 0, v + 6);
}

const BUILD = {
  [T.RES]: [house, apartment, tower, skyscraper],
  [T.COM]: [shop, office, glassTower, megatower],
  [T.IND]: [warehouse, factory, plant, campus],
};
const HEIGHTS = { [T.RES]: [100, 150, 230, 290], [T.COM]: [110, 170, 250, 330], [T.IND]: [110, 150, 220, 130] };
const PAD = { [T.RES]: '#a9dc8e', [T.COM]: '#cfd1d4', [T.IND]: '#a9a493' };

function make(w, h, ox, oy, fn, mode, lit = true, season = 0) {
  const c = mk(w, h), ctx = c.getContext('2d');
  ctx.scale(S, S);
  const k = kit(ctx, mode, ox, oy, lit, season);
  fn(k);
  return { c, ox, oy, S };
}
function memo(key, fn) { let v = cache.get(key); if (!v) { const t0 = performance.now(); v = fn(); cache.set(key, v); spriteBudget.made++; spriteBudget.left -= performance.now() - t0; } return v; }
// Drawing a building picture for the first time takes a few milliseconds on a slow phone. While the map is being
// dragged, only a little of that is allowed per frame (renderer sets spriteBudget.left each frame); pictures that
// don't fit wait for the next frame (memoLater returns null), so panning never stalls on a burst of new pictures.
export const spriteBudget = { left: Infinity, made: 0 };
// ---- seasons: trees, grass and parks change with the calendar (0 spring and summer, 1 autumn, 2 winter) ----
// Only these few pictures are made per season, so a change costs a moment, not a full redraw of the city.
let SEASON = 0;
export function setSeason(s) { if (s === SEASON) return false; SEASON = s; return true; }
export function getSeason() { return SEASON; }
// A seasonal picture: while this season's copy isn't made yet (frame budget), keep showing another season's copy.
function seasonal(key, fn) { const v = memoLater(key + 's' + SEASON, fn); if (v) return v; for (let q = 0; q < 3; q++) { const o = cache.get(key + 's' + q); if (o) return o; } return null; }
const SEASON_TINT = [null, ['#c8b26a', 0.28], ['#e4e9e6', 0.58]];
const gtint = (c) => (SEASON_TINT[SEASON] ? mix(c, SEASON_TINT[SEASON][0], SEASON_TINT[SEASON][1]) : c);
function memoLater(key, fn) { const v = cache.get(key); if (v) return v; if (spriteBudget.left <= 0) return null; return memo(key, fn); }

// shore: 0 inland, or the waterfront style (SHORE.POND / LAKE / SEA) from world.shore
export function buildingSprite(kind, level, variant, mode, lit = true, shore = 0) {
  lit = mode === 2 ? !!lit : true;
  return memoLater(`b${kind}${level}${variant}${mode}${lit ? 1 : 0}w${shore}`, () => {
    const H = shore ? WF_HEIGHTS[kind][level - 1] : HEIGHTS[kind][level - 1];
    const fn = shore ? waterfrontArt(shore, kind, level) : BUILD[kind][level - 1];
    return make(160, H, 80, H - 64, (k) => fn(k, variant), mode, lit);
  });
}
export function parkSprite(variant, mode) {
  const se = SEASON;
  return seasonal(`p${variant}${mode}`, () => make(96, 90, 48, 50, (k) => park(k, variant), mode, true, se));
}
export function zoneSprite(kind, mode) {
  return memo(`z${kind}${mode}`, () => make(64, 32, 32, 0, (k) => {
    const { P, path, ctx, C } = k;
    const col = tint(kind === T.RES ? '#4caf50' : kind === T.COM ? '#3d8bd9' : '#e0b526', mode);
    path([P(0.06, 0.06), P(0.94, 0.06), P(0.94, 0.94), P(0.06, 0.94)]);
    ctx.fillStyle = col + '55'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
  }, mode));
}
const GRASS = [['#bcd58c', '#a7bf74', '#cbb978'], ['#afd487', '#97bd6e', '#c4c27c'], ['#a4d283', '#88bf68', '#b9d88f'], ['#99cc7c', '#7db662', '#b3d98b'], ['#8dc474', '#6faa58', '#a9d382'], ['#80ba6a', '#62a04f', '#9ccb78']];
const DEEP = ['#62c1c3', '#47a8cc', '#3a91c4', '#2f7cb5'];
export function terrainSprite(type, variant, mode, tone = 2) {
  return memo(`t${type}${variant}${mode}${tone}${type === TERRAIN.WATER ? '' : 's' + SEASON}`, () => make(64, 32, 32, 0, (k) => {
    const { P, ctx, C, line, poly } = k;
    const tile = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
    if (type === TERRAIN.WATER) {
      const d = Math.min(3, tone);
      poly(tile, C(variant % 2 ? shade(DEEP[d], 1.02) : DEEP[d]), null, true);
      if (d === 0) for (let i = 0; i < 6; i++) { const p = P(0.15 + hash(i, variant, 7) * 0.7, 0.15 + hash(i, variant, 8) * 0.7); k.ell(p, 5, 1.6, 'rgba(255,250,220,.13)'); }   // sandy bottom shows through
      const g = ctx.createLinearGradient(0, 0, 64, 32); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(0,26,64,.2)');
      k.path(tile); ctx.fillStyle = g; ctx.fill();
    } else if (type === TERRAIN.SAND) {
      poly(tile, C(SEASON === 2 ? '#ebe3c8' : '#e3d39e'), null, true);                    // one base color, so sand doesn't form a checkerboard
      for (let i = 0; i < 14; i++) { const p = P(hash(i, variant, 1) * 0.9 + 0.05, hash(i, variant, 2) * 0.9 + 0.05); k.circ(p, 0.5 + hash(i, variant, 3) * 0.5, C(i % 3 ? '#c8b67c' : '#f3e7c0')); }
      for (let i = 0; i < 3; i++) { const p = P(0.2 + hash(i, variant, 4) * 0.6, 0.2 + hash(i, variant, 5) * 0.6); line(p, [p[0] + 6, p[1] + 1.5], 'rgba(150,120,70,.18)', 0.7); }
    } else {
      const pal = (GRASS[tone] || GRASS[2]).map(gtint);
      poly(tile, C(pal[0]), null, true);
      // soft mottling so neighboring tiles never look stamped
      for (let i = 0; i < 4; i++) { const p = P(0.3 + hash(i, variant, 11) * 0.4, 0.3 + hash(i, variant, 12) * 0.4); k.ell(p, 4 + hash(i, variant, 13) * 3, 2 + hash(i, variant, 14) * 1.2, i % 2 ? 'rgba(255,255,230,.05)' : 'rgba(20,60,10,.05)'); }
      for (let i = 0; i < 16; i++) {
        const p = P(hash(i, variant, 1) * 0.9 + 0.05, hash(i, variant, 2) * 0.9 + 0.05), lean = (hash(i, variant, 3) - 0.5) * 1.6;
        line(p, [p[0] + lean, p[1] - 1.6 - hash(i, variant, 4) * 1.4], C(i % 3 === 2 ? pal[2] : pal[1]), 0.7);
      }
      if (tone <= 1 && variant % 2) for (let i = 0; i < 3; i++) { const p = P(0.2 + hash(i, variant, 6) * 0.6, 0.2 + hash(i, variant, 7) * 0.6); k.ell(p, 2.2, 1, C('#c4ad6a')); }
      if (SEASON === 2) for (let i = 0; i < 7; i++) k.circ(P(hash(i, variant, 21) * 0.9 + 0.05, hash(i, variant, 22) * 0.9 + 0.05), 0.8 + hash(i, variant, 23) * 0.9, 'rgba(255,255,255,.7)');   // frost and patches of snow
      if (tone >= 3 && variant === 3 && SEASON === 0) for (let i = 0; i < 4; i++) k.circ(P(0.2 + hash(i, tone, 8) * 0.6, 0.2 + hash(i, tone, 9) * 0.6), 0.7, C(['#ffffff', '#f4d35e', '#f2a7c3'][i % 3]));
    }
  }, mode));
}
export function treeSprite(variant, mode) {
  const se = SEASON;
  return seasonal(`tr${variant}${mode}`, () => make(64, 72, 32, 32, (k) => {
    const v = variant;
    k.tree(0.5, 0.5, v === 2 ? 1 : v === 3 ? 2 : v === 4 ? 3 : 0, v + 7);
    if (v % 2 === 0) k.tree(0.22, 0.7, 0, v + 9);
  }, mode, true, se));
}
export function roadSprite(mask, mode) {
  return memo(`r${mask}${mode}`, () => make(64, 32, 32, 0, (k) => {
    const { P, path, ctx, C, line, poly } = k;
    const hw = 0.36, a = 0.5 - hw, b = 0.5 + hw;
    poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], C('#cdcac2'), null, true);
    for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; line(P(t, 0), P(t, 0.06), 'rgba(0,0,0,.08)', 0.5); line(P(0, t), P(0.06, t), 'rgba(0,0,0,.08)', 0.5); }   // paving joints
    const pieces = [[a, a, b, b]];
    if (mask & 1) pieces.push([a, 0, b, a]);
    if (mask & 2) pieces.push([b, a, 1, b]);
    if (mask & 4) pieces.push([a, b, b, 1]);
    if (mask & 8) pieces.push([0, a, a, b]);
    const q = (p) => [P(p[0], p[1]), P(p[2], p[1]), P(p[2], p[3]), P(p[0], p[3])];
    ctx.lineJoin = 'miter';
    for (const p of pieces) { path(q(p)); ctx.strokeStyle = C('#9a9ca2'); ctx.lineWidth = 2.4; ctx.stroke(); }
    for (const p of pieces) { path(q(p)); ctx.fillStyle = C('#4e535b'); ctx.fill(); }
    ctx.save(); path(q(pieces[0])); for (const p of pieces.slice(1)) { const r = q(p); ctx.moveTo(r[0][0], r[0][1]); for (const v of r.slice(1)) ctx.lineTo(v[0], v[1]); ctx.closePath(); } ctx.clip();
    for (let i = 0; i < 70; i++) { const pp = P(hash(i, mask, 1), hash(i, mask, 2)); ctx.fillStyle = i % 3 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.16)'; ctx.fillRect(pp[0], pp[1], 0.7, 0.5); }   // aggregate in the asphalt
    const wear = 'rgba(20,22,26,.16)';                                                                                             // darker tire tracks
    if (mask & 5) for (const u of [0.38, 0.62]) line(P(u, mask & 1 ? 0 : a), P(u, mask & 4 ? 1 : b), wear, 2.2);
    if (mask & 10) for (const v of [0.38, 0.62]) line(P(mask & 8 ? 0 : a, v), P(mask & 2 ? 1 : b, v), wear, 2.2);
    if (hash(mask, 3, 3) > 0.4) { const c0 = P(0.3 + hash(mask, 1, 9) * 0.3, 0.35); ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c0[0] + 3, c0[1] + 1.5); ctx.lineTo(c0[0] + 4, c0[1] + 3.5); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 0.4; ctx.stroke(); }   // a crack
    ctx.restore();
    for (const p of pieces) { path(q(p)); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 0.5; ctx.stroke(); }                       // curb highlight
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

// Flag poles are part of the picture; the cloth waves live (renderer.flags), or is drawn still on Smooth graphics.
function flag(k, x, y, h) {
  const { P, line, C } = k, b = P(x, y), t = [b[0], b[1] - h];
  line(b, t, C('#8b8f96'), 1.2); k.circ(t, 1, C('#c9ccd2'));
}
export const SVC_FLAGS = { 8: [[0.35, 1.45, 36, '#2f5fb0'], [0.55, 1.5, 36, '#e0483f']], 9: [[1.6, 1.5, 32, '#cf4b3f']], 11: [[2.75, 1.7, 38, '#2f5fb0']] };
function door(k, x, y, u0, u1, h, col) { const { P, poly, C } = k; poly([P(x + u0, y, 0), P(x + u1, y, 0), P(x + u1, y, h), P(x + u0, y, h)], C(col || '#35566b')); }
function helipad(k, x, y, z) {
  const { P, ell, line, C } = k, c = P(x, y, z);
  ell(c, 20, 10, C('#4a5568')); ell(c, 17, 8.5, C('#5a6475'));
  line([c[0] - 6, c[1] - 3], [c[0] - 6, c[1] + 3], '#f2f2f2', 1.6); line([c[0] + 6, c[1] - 3], [c[0] + 6, c[1] + 3], '#f2f2f2', 1.6); line([c[0] - 6, c[1]], [c[0] + 6, c[1]], '#f2f2f2', 1.6);
}
function policeHQ(k) {
  const { P, poly, box, faces, sh, C, circ } = k;
  padRect(k, 2, 2, '#cfd1d4', null);
  const x = 0.15, y = 0.15, w = 1.5, d = 0.95, h = 54;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#dfe6f0', r: shade('#dfe6f0', 0.76), t: '#a3a9b3' });
  poly([P(x, y + d, 26), P(x + w, y + d, 26), P(x + w, y + d, 33), P(x, y + d, 33)], C('#2f5fb0'));
  k.wins(x, y, w, d, h, 81, { dens: 3.4, rh: 11, wh: 6, base: 6 });
  poly([P(x + 0.62, y + d, 0), P(x + 0.92, y + d, 0), P(x + 0.92, y + d, 16), P(x + 0.62, y + d, 16)], C(k.store()));
  poly([P(x + 0.55, y + d, 16), P(x + 0.99, y + d, 16), P(x + 0.99, y + d + 0.16, 13), P(x + 0.55, y + d + 0.16, 13)], C('#2f5fb0'));
  helipad(k, x + 0.45, y + 0.45, h);
  box(x + 1.1, y + 0.2, 0.1, 0.1, 30, faces('#8b929c'), h); const lb = P(x + 1.15, y + 0.25, h + 31); circ(lb, 2, '#ff3b30');
  flag(k, 0.35, 1.45, 36, '#2f5fb0'); flag(k, 0.55, 1.5, 36, '#e0483f');
  box(1.15, 1.35, 0.4, 0.16, 5, faces('#f2f2f2')); box(1.15, 1.35, 0.4, 0.16, 2, faces('#2f5fb0'), 1);
  box(1.15, 1.6, 0.4, 0.16, 5, faces('#f2f2f2')); box(1.15, 1.6, 0.4, 0.16, 2, faces('#2f5fb0'), 1);
  circ(P(1.35, 1.43, 8), 1.6, '#e0483f'); circ(P(1.35, 1.68, 8), 1.6, '#3a7bd5');
}
function fireHQ(k) {
  const { P, poly, box, faces, sh, C, line } = k;
  padRect(k, 2, 2, '#cfd1d4', null);
  const x = 0.12, y = 0.2, w = 1.5, d = 0.95, h = 46;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#cf4b3f', r: shade('#cf4b3f', 0.76), t: '#a3a9b3' });
  poly([P(x, y + d, 28), P(x + w, y + d, 28), P(x + w, y + d, 33), P(x, y + d, 33)], C('#f2f2f2'));
  for (let i = 0; i < 3; i++) { const a = 0.1 + i * 0.48, b = a + 0.38; poly([P(x + a, y + d, 0), P(x + b, y + d, 0), P(x + b, y + d, 24), P(x + a, y + d, 24)], C('#e9ecf0')); for (let z = 3; z < 24; z += 3) line(P(x + a, y + d, z), P(x + b, y + d, z), 'rgba(0,0,0,.2)', 0.6); }
  k.wins(x, y, w, d, h, 82, { dens: 2.4, rh: 10, wh: 5, base: 35 });
  box(1.4, 0.18, 0.24, 0.24, 88, faces('#cf4b3f')); for (let z = 20; z < 88; z += 22) box(1.4, 0.18, 0.24, 0.24, 8, faces('#f4c542'), z);
  box(1.36, 0.14, 0.32, 0.32, 6, faces('#8b929c'), 88); sh(1.4, 0.18, 0.24, 0.24, 94);
  box(0.25, 1.35, 0.7, 0.2, 7, faces('#d03a2f')); box(0.25, 1.35, 0.2, 0.2, 5, faces('#e9ecf0'), 7);
  line(P(0.45, 1.45, 14), P(0.9, 1.45, 14), '#c9ccd2', 1.4); line(P(0.45, 1.5, 14), P(0.9, 1.5, 14), '#c9ccd2', 1.4);
  flag(k, 1.6, 1.5, 32, '#cf4b3f');
}
function hospital(k) {
  const { P, poly, box, faces, sh, C, line } = k;
  padRect(k, 2, 2, '#cfd1d4', null);
  sh(0.2, 0.2, 0.95, 0.85, 80);
  box(0.2, 0.2, 0.95, 0.85, 80, { l: '#f0f3f6', r: shade('#f0f3f6', 0.78), t: '#a3a9b3' });
  k.wins(0.2, 0.2, 0.95, 0.85, 80, 83, { dens: 3.6, rh: 10, wh: 5.5, base: 16 });
  box(1.15, 0.45, 0.7, 0.8, 38, { l: '#e6eaee', r: shade('#e6eaee', 0.78), t: '#a3a9b3' });
  k.wins(1.15, 0.45, 0.7, 0.8, 38, 84, { dens: 3, rh: 10, wh: 5.5, base: 10 });
  const cx = 0.675, y = 1.05;
  poly([P(cx - 0.07, y, 36), P(cx + 0.07, y, 36), P(cx + 0.07, y, 66), P(cx - 0.07, y, 66)], C('#e0483f'));
  poly([P(cx - 0.2, y, 45), P(cx + 0.2, y, 45), P(cx + 0.2, y, 57), P(cx - 0.2, y, 57)], C('#e0483f'));
  poly([P(0.5, y, 0), P(0.85, y, 0), P(0.85, y, 14), P(0.5, y, 14)], C(k.store()));
  poly([P(0.4, y, 14), P(0.95, y, 14), P(0.95, y + 0.3, 11), P(0.4, y + 0.3, 11)], C('#e0483f'));
  helipad(k, 1.5, 0.85, 38);
  box(0.4, 1.55, 0.4, 0.16, 5, faces('#f7f7f7')); box(0.4, 1.55, 0.4, 0.16, 1.8, faces('#e0483f'), 2);
  box(0.9, 1.6, 0.4, 0.16, 5, faces('#f7f7f7')); box(0.9, 1.6, 0.4, 0.16, 1.8, faces('#e0483f'), 2);
}
function university(k) {
  const { P, poly, box, faces, sh, C, line, tree, ell, circ } = k;
  padRect(k, 3, 3, '#b9d9a0', ['#4d8f3c', '#8fd070']);
  poly([P(1.2, 1.7), P(1.8, 1.7), P(1.8, 3), P(1.2, 3)], C('#d9cfae'), null, true);
  sh(0.3, 0.3, 2.4, 1.3, 60);
  box(0.3, 0.35, 0.85, 1.25, 42, faces('#c78b6a')); k.wins(0.3, 0.35, 0.85, 1.25, 42, 91, { dens: 3.4, rh: 12, wh: 6, base: 8 });
  box(1.85, 0.35, 0.85, 1.25, 42, faces('#c78b6a')); k.wins(1.85, 0.35, 0.85, 1.25, 42, 92, { dens: 3.4, rh: 12, wh: 6, base: 8 });
  box(1.1, 0.5, 0.8, 1.0, 58, faces('#e3d9c4')); k.wins(1.1, 0.5, 0.8, 1.0, 58, 93, { dens: 3, rh: 12, wh: 6, base: 18 });
  for (let i = 0; i < 4; i++) box(1.18 + i * 0.2, 1.5, 0.07, 0.07, 22, faces('#f2efe6'));
  poly([P(1.1, 1.58, 24), P(1.9, 1.58, 24), P(1.9, 1.58, 29), P(1.1, 1.58, 29)], C('#d9cfae'));
  box(1.38, 0.72, 0.24, 0.24, 36, faces('#d9a58a'), 58);
  poly([P(1.38, 0.96, 74), P(1.62, 0.96, 74), P(1.62, 0.96, 88), P(1.38, 0.96, 88)], C('#f2f2f2'));
  const t1 = P(1.5, 0.84, 94), b1 = P(1.38, 0.72, 94);
  k.ctx.beginPath(); k.ctx.moveTo(P(1.36, 0.96, 94)[0], P(1.36, 0.96, 94)[1]); k.ctx.lineTo(t1[0], t1[1] - 16); k.ctx.lineTo(P(1.64, 0.96, 94)[0], P(1.64, 0.96, 94)[1]); k.ctx.closePath(); k.ctx.fillStyle = C('#8d4b3c'); k.ctx.fill();
  const f = P(1.5, 2.35); ell([f[0], f[1] + 1], 14, 7, C('#b9b194')); ell([f[0], f[1] - 1], 11, 5.5, C('#62b6e6'));
  line([f[0], f[1] - 2], [f[0], f[1] - 12], C('#bfe6fa'), 1.8);
  tree(0.3, 1.9, 0, 3); tree(2.7, 1.9, 1, 4); tree(0.5, 2.7, 3, 5); tree(2.5, 2.7, 0, 6);
  flag(k, 2.75, 1.7, 38, '#2f5fb0');
}
function plaza(k) {
  const { P, poly, line, ell, circ, tree, C, box } = k;
  padRect(k, 2, 2, '#dcd3b4', null);
  for (let i = 1; i < 8; i++) { line(P(i / 4, 0), P(i / 4, 2), 'rgba(0,0,0,.08)', 0.6); line(P(0, i / 4), P(2, i / 4), 'rgba(0,0,0,.08)', 0.6); }
  const c = P(1, 1);
  ell([c[0], c[1] + 2], 34, 17, C('#b9b194')); ell([c[0], c[1]], 30, 15, C('#e4dcc0')); ell([c[0], c[1] - 1], 25, 12.5, C('#62b6e6')); ell([c[0], c[1] - 2], 10, 5, C('#d8f1fc'));
  line([c[0], c[1] - 2], [c[0], c[1] - 28], C('#bfe6fa'), 2.4); ell([c[0], c[1] - 28], 7, 3.5, C('#d8f1fc'));
  line([c[0], c[1] - 22], [c[0] - 12, c[1] - 10], C('#bfe6fa'), 1.4); line([c[0], c[1] - 22], [c[0] + 12, c[1] - 10], C('#bfe6fa'), 1.4);
  const fc = ['#e86f9b', '#f4c542', '#e04848', '#ffffff'];
  for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.283; circ([c[0] + Math.cos(a) * 46, c[1] + Math.sin(a) * 23], 2, C(fc[i % 4])); }
  const wd = { l: '#8a5a34', r: '#6b4426', t: '#a06a3c' };
  box(0.2, 1.55, 0.3, 0.09, 2.4, wd); box(0.2, 1.55, 0.3, 0.02, 3, wd, 2.4); box(1.55, 0.25, 0.09, 0.3, 2.4, wd);
  tree(0.2, 0.2, 0, 11); tree(1.8, 1.8, 3, 12); tree(0.25, 1.8, 1, 13); tree(1.8, 0.2, 0, 14);
}
function library(k) {
  const { P, poly, box, faces, sh, C, line } = k;
  k.pad('#cfd1d4', null);
  const x = 0.1, y = 0.18, w = 0.8, d = 0.62, h = 32;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#e9e2d0', r: shade('#e9e2d0', 0.78), t: '#a3a9b3' });
  for (let i = 0; i < 5; i++) box(x + 0.07 + i * 0.15, y + d, 0.06, 0.06, 26, faces('#f6f2e8'));
  poly([P(x, y + d + 0.06, 26), P(x + w, y + d + 0.06, 26), P(x + w / 2, y + d + 0.06, 40)], C('#d9d2bf'));
  poly([P(x - 0.02, y + d + 0.06, 26), P(x + w + 0.02, y + d + 0.06, 26), P(x + w + 0.02, y + d + 0.06, 29), P(x - 0.02, y + d + 0.06, 29)], C('#f2efe6'));
  for (let i = 0; i < 3; i++) poly([P(x + 0.05, y + d + 0.08 + i * 0.04, i * 2), P(x + w - 0.05, y + d + 0.08 + i * 0.04, i * 2), P(x + w - 0.05, y + d + 0.08 + i * 0.04, i * 2 + 2), P(x + 0.05, y + d + 0.08 + i * 0.04, i * 2 + 2)], C('#d9d2bf'));
  k.wins(x, y, w, d, h, 94, { dens: 1.6, rh: 20, wh: 7, base: 6 });
}
function museum(k) {
  const { P, poly, box, faces, sh, C, line, ctx } = k;
  padRect(k, 2, 2, '#dcd3b4', null);
  const x = 0.15, y = 0.25, w = 1.7, d = 1.0, h = 38;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#e3dcc8', r: shade('#e3dcc8', 0.78), t: '#a3a9b3' });
  for (let i = 0; i < 8; i++) box(x + 0.06 + i * 0.2, y + d, 0.07, 0.07, 30, faces('#f6f2e8'));
  poly([P(x, y + d + 0.07, 30), P(x + w, y + d + 0.07, 30), P(x + w, y + d + 0.07, 34), P(x, y + d + 0.07, 34)], C('#f2efe6'));
  for (let i = 0; i < 4; i++) { const u = x + 0.12 + i * 0.4; poly([P(u, y + d + 0.1, 8), P(u + 0.18, y + d + 0.1, 8), P(u + 0.18, y + d + 0.1, 26), P(u, y + d + 0.1, 26)], C(['#c0392b', '#2e86c1', '#27ae60', '#e67e22'][i]), null, true); }
  const c = P(x + w / 2, y + d / 2, h);
  ctx.beginPath(); ctx.ellipse(c[0], c[1], 26, 13, 0, 0, 6.2832); ctx.fillStyle = C('#cfd6d0'); ctx.fill();
  ctx.beginPath(); ctx.moveTo(c[0] - 24, c[1]); ctx.bezierCurveTo(c[0] - 24, c[1] - 34, c[0] + 24, c[1] - 34, c[0] + 24, c[1]); ctx.closePath(); ctx.fillStyle = C('#7fb7a4'); ctx.fill();
  ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.bezierCurveTo(c[0], c[1] - 34, c[0] + 24, c[1] - 34, c[0] + 24, c[1]); ctx.closePath(); ctx.fillStyle = C('#6ca08d'); ctx.fill();
  line([c[0], c[1] - 26], [c[0], c[1] - 36], C('#c9b46a'), 1.4);
  poly([P(x + 0.7, y + d, 0), P(x + 1.0, y + d, 0), P(x + 1.0, y + d, 14), P(x + 0.7, y + d, 14)], C(k.store()));
}
function stadium(k) {
  const { P, ell, ctx, line, poly, box, faces, C, circ } = k;
  padRect(k, 3, 3, '#cfd1d4', null);
  const c = P(1.5, 1.5);
  ctx.fillStyle = k.mode === 2 ? 'rgba(0,0,0,.22)' : 'rgba(10,20,40,.16)'; ctx.beginPath(); ctx.ellipse(c[0] + 14, c[1] + 4, 94, 47, 0, 0, 6.2832); ctx.fill();
  for (let z = 0; z <= 24; z += 2) { ctx.beginPath(); ctx.ellipse(c[0], c[1] - z, 90, 45, 0, 0, 6.2832); ctx.fillStyle = C(z < 12 ? '#aab1bc' : '#c3c9d2'); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(c[0], c[1] - 24, 90, 45, 0, 0, 6.2832); ctx.fillStyle = C('#e6e9ee'); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.8; ctx.stroke();
  ell([c[0], c[1] - 22], 76, 38, C('#c9372c')); ell([c[0], c[1] - 20], 66, 33, C('#2f5fb0')); ell([c[0], c[1] - 18], 58, 29, C('#d9a441'));
  ell([c[0], c[1] - 12], 50, 25, C('#4aa05a'));
  for (let i = -4; i <= 4; i++) { ctx.save(); ctx.beginPath(); ctx.ellipse(c[0], c[1] - 12, 50, 25, 0, 0, 6.2832); ctx.clip(); line([c[0] + i * 11 - 6, c[1] - 40], [c[0] + i * 11 + 6, c[1] + 14], C(i % 2 ? '#43964f' : '#52ad62'), 6); ctx.restore(); }
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(c[0], c[1] - 12, 38, 19, 0, 0, 6.2832); ctx.stroke(); line([c[0] - 20, c[1] - 22], [c[0] + 20, c[1] - 2], 'rgba(255,255,255,.85)', 1.2);
  ctx.beginPath(); ctx.ellipse(c[0], c[1] - 12, 7, 3.5, 0, 0, 6.2832); ctx.stroke();
  for (const [x, y] of [[0.15, 0.15], [2.85, 0.15], [0.15, 2.85], [2.85, 2.85]]) {
    box(x - 0.04, y - 0.04, 0.08, 0.08, 70, faces('#8b929c'));
    const t = P(x, y, 74); poly([[t[0] - 9, t[1]], [t[0] + 9, t[1] + 3], [t[0] + 9, t[1] - 9], [t[0] - 9, t[1] - 12]], C(k.mode === 2 && k.lit ? '#fff2b8' : '#dfe3e8'));
  }
  poly([P(1.1, 2.62, 0), P(1.9, 2.62, 0), P(1.9, 2.62, 10), P(1.1, 2.62, 10)], C('#4a5568'));
  for (let i = 0; i < 6; i++) circ(P(0.4 + i * 0.4, 2.9, 2), 2, C(['#e0483f', '#f4c542', '#3a7bd5'][i % 3]));
}
// Landfill: a fenced lot in four terraced cells, like a real one is filled. Back left is finished and grassed over,
// back right is capped with soil, front left is the active cell with fresh waste and a compactor, front right is the
// gravel yard with the site office and a weighbridge. Everything stays inside the 2x2 diamond, like other buildings.
function dump(k) {
  const { P, poly, box, faces, sh, C, line, circ, ell } = k;
  padRect(k, 2, 2, '#9c8b69', ['#86765a', '#ad9d7c']);
  const cell = (x0, y0, x1, y1, h, top, side) => {           // a raised cell with its two visible side faces
    poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)], C(side));
    poly([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)], C(shade(side, 0.8)));
    poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], C(top));
  };
  // back left: finished, grassed, with a gas vent
  cell(0.08, 0.08, 0.96, 0.96, 9, '#7fa65c', '#8b7656');
  for (let i = 0; i < 18; i++) { const p = P(0.14 + hash(i, 3, 1) * 0.76, 0.14 + hash(i, 4, 1) * 0.76, 9); line(p, [p[0] + 1.6, p[1] - 1.2], C(i % 2 ? '#6d9450' : '#93b96c'), 0.9); }
  box(0.5, 0.48, 0.05, 0.05, 15, faces('#7b828c'), 9);
  // back right: capped with soil, a few seeded strips
  cell(1.04, 0.08, 1.92, 0.96, 7, '#8f7a57', '#7c6849');
  for (let j = 0; j < 4; j++) line(P(1.12, 0.22 + j * 0.2, 7), P(1.84, 0.22 + j * 0.2, 7), C(j % 2 ? '#a08b66' : '#7e6a4b'), 1.2);
  // front left: the active cell, a little lower, with fresh waste in muted colours and bin bags
  cell(0.08, 1.04, 0.96, 1.92, 3, '#6f6452', '#6a5b46');
  const tc = ['#b9b2a4', '#8a8f96', '#a8826a', '#d8d4c8', '#6f7d6a', '#7f8fa6', '#b07a68', '#c8bc8a'];
  for (let i = 0; i < 90; i++) { const u = 0.13 + hash(i, 7, 3) * 0.78, v = 1.09 + hash(i, 8, 3) * 0.78, q = P(u, v, 3 + hash(i, 9, 3) * 3); k.ctx.fillStyle = C(tc[i % tc.length]); k.ctx.fillRect(q[0] - 1.2, q[1] - 0.9, 2.4, 1.8); }
  for (let i = 0; i < 9; i++) { const q = P(0.2 + hash(i, 11, 2) * 0.66, 1.18 + hash(i, 12, 2) * 0.6, 6); ell(q, 2.4, 1.7, C(i % 3 ? '#2e3238' : '#3b4a5c')); }
  // the compactor working the cell, and its tracks
  line(P(0.3, 1.86, 3.2), P(0.62, 1.4, 3.2), C('#5c5040'), 2.2);
  sh(0.56, 1.36, 0.26, 0.18, 9);
  box(0.56, 1.36, 0.26, 0.18, 6, faces('#e3b33c'), 3);
  box(0.62, 1.39, 0.12, 0.12, 6, faces('#2f3540'), 9);
  box(0.5, 1.35, 0.05, 0.2, 4, faces('#8a8f96'), 3);
  // front right: gravel yard, site office, weighbridge
  poly([P(1.04, 1.04), P(1.92, 1.04), P(1.92, 1.92), P(1.04, 1.92)], C('#b8b2a2'));
  for (let i = 0; i < 26; i++) { const q = P(1.08 + hash(i, 13, 4) * 0.8, 1.08 + hash(i, 14, 4) * 0.8); circ(q, 0.7, C(i % 2 ? '#a39d8e' : '#cbc5b6')); }
  poly([P(1.1, 1.62, 0.5), P(1.7, 1.62, 0.5), P(1.7, 1.86, 0.5), P(1.1, 1.86, 0.5)], C('#7d838c'));
  line(P(1.1, 1.62, 0.5), P(1.7, 1.62, 0.5), C('#5d636c'), 0.8);
  sh(1.48, 1.12, 0.36, 0.3, 13);
  box(1.48, 1.12, 0.36, 0.3, 12, faces('#e8e6df'));
  poly([P(1.48, 1.12, 12), P(1.84, 1.12, 12), P(1.84, 1.42, 12), P(1.48, 1.42, 12)], C('#4f6f5a'));
  poly([P(1.54, 1.42, 4), P(1.66, 1.42, 4), P(1.66, 1.42, 9), P(1.54, 1.42, 9)], C(k.mode === 2 ? '#ffe7a0' : '#5d7f9a'));
  poly([P(1.84, 1.18, 4), P(1.84, 1.34, 4), P(1.84, 1.34, 9), P(1.84, 1.18, 9)], C(k.mode === 2 ? '#ffe7a0' : '#55768f'));
  box(1.14, 1.14, 0.2, 0.14, 6, faces('#3f8f5a')); box(1.14, 1.3, 0.2, 0.14, 6, faces('#3d6fb0'));   // skips by the office
  // (gulls over the landfill are live, see renderer.gulls: painted into the picture they looked stuck on the building behind)
  // chain-link fence along the two front edges, with a gate to the yard
  for (let i = 0; i <= 8; i++) { const u = i / 4; if (u < 1.2 || u > 1.5) line(P(u, 1.98), P(u, 1.98, 8), C('#6b7280'), 0.7); line(P(1.98, u), P(1.98, u, 8), C('#6b7280'), 0.7); }
  line(P(0, 1.98, 8), P(1.2, 1.98, 8), C('#6b7280'), 0.8); line(P(1.5, 1.98, 8), P(2, 1.98, 8), C('#6b7280'), 0.8);
  line(P(0, 1.98, 4), P(1.2, 1.98, 4), 'rgba(107,114,128,.45)', 0.5); line(P(1.5, 1.98, 4), P(2, 1.98, 4), 'rgba(107,114,128,.45)', 0.5);
  line(P(1.98, 0, 8), P(1.98, 2, 8), C('#6b7280'), 0.8); line(P(1.98, 0, 4), P(1.98, 2, 4), 'rgba(107,114,128,.45)', 0.5);
}
// ---------- shore buildings: drawn facing the water (face 0..3), reaching out over it ----------
// L(u, v, z) turns local shore coordinates into the picture: u = out from the water edge (negative = on land), v = along the shore.
function shoreKit(k, face, s) {
  const { P, poly, box, C, ctx } = k;
  const XY = (u, v) => (face === 0 ? [s + u, v] : face === 1 ? [v, s + u] : face === 2 ? [-u, v] : [v, -u]);
  const L = (u, v, z = 0) => { const [x, y] = XY(u, v); return P(x, y, z); };
  const rect = (u0, v0, u1, v1) => { const a = XY(u0, v0), b = XY(u1, v1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])]; };
  const quad = (u0, v0, u1, v1, z, col, noStroke) => poly([L(u0, v0, z), L(u1, v0, z), L(u1, v1, z), L(u0, v1, z)], typeof col === 'string' && col[0] === '#' ? C(col) : col, null, noStroke);
  const lbox = (u0, v0, u1, v1, h, col, z0 = 0) => { const [x, y, w, d] = rect(u0, v0, u1, v1); box(x, y, w, d, h, col, z0); };
  const lsh = (u0, v0, u1, v1, h) => { const [x, y, w, d] = rect(u0, v0, u1, v1); k.sh(x, y, w, d, h); };
  // a raised wooden deck on posts, with its shadow on the water and railings
  const deck = (u0, v0, u1, v1, z, col, rail) => {
    quad(u0 + 0.06, v0 + 0.06, u1 + 0.08, v1 + 0.08, 0, 'rgba(10,30,50,.28)', true);
    for (let u = Math.max(0.15, u0 + 0.1); u <= u1 - 0.05; u += 0.4) for (const v of [v0 + 0.03, v1 - 0.03]) k.line(L(u, v, 0), L(u, v, z), C('#5b4632'), 1.3);
    quad(u0, v0, u1, v1, z, col);
    for (let u = u0 + 0.1; u < u1; u += 0.1) k.line(L(u, v0, z), L(u, v1, z), 'rgba(60,40,20,.18)', 0.5);
    if (rail) for (const v of [v0, v1]) { k.line(L(Math.max(u0, 0), v, z + 4), L(u1, v, z + 4), C('#e8e2d4'), 0.8); for (let u = Math.max(u0, 0); u <= u1 + 0.01; u += 0.25) k.line(L(u, v, z), L(u, v, z + 4), C('#e8e2d4'), 0.6); }
  };
  const person = (u, v, z, col) => { const p = L(u, v, z); k.line(p, [p[0], p[1] - 5], C('#3b3f47'), 1.4); k.circ([p[0], p[1] - 7], 1.6, C('#e0b48c')); k.ctx.fillStyle = C(col); k.ctx.fillRect(p[0] - 1.3, p[1] - 5.5, 2.6, 3); };
  const back = face >= 2;                              // water behind the land part: draw the water part first
  return { L, quad, lbox, lsh, deck, person, back, ctx };
}
function pier(k, face) {
  const { C, line, circ, faces } = k, S = shoreKit(k, face, 1);
  const land = () => {
    S.quad(-0.95, 0.08, 0, 0.92, 0, '#cfc6b2');
    for (let i = 0; i < 6; i++) line(S.L(-0.9 + i * 0.15, 0.1), S.L(-0.9 + i * 0.15, 0.9), 'rgba(120,100,70,.18)', 0.5);
    S.lsh(-0.8, 0.12, -0.45, 0.42, 14); S.lbox(-0.8, 0.12, -0.45, 0.42, 13, faces('#3f7fa8'));     // bait and tackle shack
    S.quad(-0.8, 0.1, -0.45, 0.44, 13, '#d9534a');
    S.lbox(-0.35, 0.62, -0.1, 0.72, 3, faces('#8b6a45'));                                         // bench
    line(S.L(-0.2, 0.2), S.L(-0.2, 0.2, 22), C('#4a5260'), 1); circ(S.L(-0.2, 0.2, 23), 1.8, C(k.mode === 2 ? '#ffe9a8' : '#f4f1e6'));
  };
  const sea = () => {
    S.deck(-0.05, 0.34, 1.62, 0.66, 5, '#b48a5c', true);
    S.deck(1.4, 0.12, 1.86, 0.88, 5, '#b48a5c', true);                                            // T-head at the end
    for (const [u, v, c] of [[1.7, 0.2, '#d9534a'], [1.75, 0.78, '#3d6fb0'], [0.9, 0.62, '#e0b526']]) {
      S.person(u, v, 5, c);
      const p = S.L(u, v, 12), q = S.L(u + 0.3, v + (v < 0.5 ? -0.22 : 0.22), 0);
      line([p[0], p[1]], [q[0], q[1]], 'rgba(255,255,255,.6)', 0.5);                                // fishing line
    }
    line(S.L(1.86, 0.5, 5), S.L(1.86, 0.5, 26), C('#4a5260'), 1); circ(S.L(1.86, 0.5, 27), 1.8, C(k.mode === 2 ? '#ffe9a8' : '#f4f1e6'));
  };
  if (S.back) { sea(); land(); } else { land(); sea(); }
}
function beach(k, face) {
  const { C, line, circ, ell, faces } = k, S = shoreKit(k, face, 2);
  const land = () => {
    S.quad(-2, 0, 0, 2, 0, '#efdcab', true);
    for (let i = 0; i < 40; i++) { const p = S.L(-1.9 + hash(i, 1, 9) * 1.85, 0.05 + hash(i, 2, 9) * 1.9); circ(p, 0.6, C(i % 2 ? '#e3cd96' : '#f7e8c0')); }
    S.quad(-0.12, 0, 0.02, 2, 0, 'rgba(255,255,255,.55)', true);                                   // wet sand line
    const tw = ['#d9534a', '#3d8bd9', '#f4c542', '#5fbf8a', '#e57fb0', '#ffffff'];
    for (let i = 0; i < 6; i++) { const u = -1.6 + (i % 3) * 0.5 + hash(i, 3, 9) * 0.15, v = 0.3 + Math.floor(i / 3) * 0.9 + hash(i, 4, 9) * 0.2; S.quad(u, v, u + 0.12, v + 0.24, 0.3, tw[i], true); }
    const uc = [['#d9534a', '#ffffff'], ['#3d8bd9', '#ffffff'], ['#f4c542', '#e8823a'], ['#5fbf8a', '#ffffff']];
    for (let i = 0; i < 4; i++) {
      const u = -1.45 + (i % 2) * 0.75, v = 0.55 + Math.floor(i / 2) * 0.9, base = S.L(u, v), top = [base[0], base[1] - 17];
      ell([base[0] + 4, base[1] + 1], 9, 4, 'rgba(0,0,0,.16)');
      line(base, top, C('#6b6b6b'), 1);
      for (let j = 0; j < 8; j++) { k.ctx.beginPath(); k.ctx.moveTo(top[0], top[1] - 2); k.ctx.arc(top[0], top[1] + 1, 9, Math.PI + j * Math.PI / 8, Math.PI + (j + 1) * Math.PI / 8); k.ctx.closePath(); k.ctx.fillStyle = C(uc[i][j % 2]); k.ctx.fill(); }
    }
    S.person(-0.9, 1.5, 0, '#3d8bd9'); S.person(-0.5, 0.35, 0, '#d9534a');
    // lifeguard chair at the back
    for (const [a, b] of [[-1.85, 1.75], [-1.7, 1.75], [-1.85, 1.9], [-1.7, 1.9]]) line(S.L(a, b), S.L(a, b, 13), C('#ffffff'), 1);
    S.lbox(-1.9, 1.7, -1.65, 1.95, 4, faces('#d9534a'), 13); line(S.L(-1.78, 1.82, 17), S.L(-1.78, 1.82, 28), C('#888'), 0.8);
    S.quad(-1.78, 1.82, -1.78, 1.82, 28, '#d9534a');
  };
  const sea = () => {
    for (let i = 0; i <= 8; i++) circ(S.L(0.92, 0.1 + i * 0.225, 1), 1.3, C(i % 2 ? '#f4c542' : '#e8823a'));   // buoy line
    for (let i = 0; i < 5; i++) { const p = S.L(0.25 + hash(i, 5, 9) * 0.55, 0.2 + hash(i, 6, 9) * 1.6, 0); ell([p[0], p[1] + 0.5], 3.2, 1.3, 'rgba(255,255,255,.55)'); circ([p[0], p[1] - 1.2], 1.5, C('#d8a47c')); }
    const b = S.L(0.45, 1.3, 0.5), b2 = S.L(0.45, 1.55, 0.5); line(b, b2, C('#f2f2f2'), 3);            // a surfboard
  };
  if (S.back) { sea(); land(); } else { land(); sea(); }
}
function marina(k, face) {
  const { C, line, faces } = k, S = shoreKit(k, face, 2);
  const boat = (u, v, along, col, mast) => {                    // moored boat pointing out to the water
    const h = 0.42, w = 0.13, p = (a, b, z = 1.5) => S.L(u + a, v + b, z);
    S.quad(u - 0.02, v - w / 2 + 0.04, u + h, v + w / 2 + 0.06, 0, 'rgba(10,30,50,.25)', true);
    k.poly([p(0, -w / 2), p(h * 0.75, -w / 2), p(h, 0), p(h * 0.75, w / 2), p(0, w / 2)], C('#f4f4f0'));
    k.poly([p(0.06, -w / 4, 2.5), p(h * 0.6, -w / 4, 2.5), p(h * 0.6, w / 4, 2.5), p(0.06, w / 4, 2.5)], C(col));
    if (mast) line(S.L(u + h * 0.45, v, 2), S.L(u + h * 0.45, v, 24), C('#d8d8d8'), 0.8);
  };
  const land = () => {
    S.quad(-2, 0, 0, 2, 0, '#c9c4b8');
    S.lsh(-1.75, 0.15, -1.0, 0.9, 18); S.lbox(-1.75, 0.15, -1.0, 0.9, 16, faces('#f2f0ea'));      // clubhouse
    S.quad(-1.8, 0.1, -0.95, 0.95, 16, '#2f6fa8');
    S.quad(-1.0, 0.25, -0.98, 0.8, 8, k.mode === 2 ? '#ffe7a0' : '#7fb0d0', true);
    for (let i = 0; i < 3; i++) S.lbox(-1.7 + i * 0.4, 1.3, -1.45 + i * 0.4, 1.75, 5, faces(['#d9534a', '#3d6fb0', '#e8e8e8'][i]));   // boats on trailers
    line(S.L(-0.3, 1.8), S.L(-0.3, 1.8, 32), C('#d8d8d8'), 1); S.quad(-0.3, 1.8, -0.3, 1.6, 30, '#3d6fb0');
    const f = S.L(-0.3, 1.8, 32); k.poly([f, [f[0] + 9, f[1] + 2], [f[0], f[1] + 5]], C('#3d6fb0'));
  };
  const sea = () => {
    S.deck(-0.05, 0.92, 1.92, 1.08, 2, '#c8b08a', false);                                          // main walkway
    for (const u of [0.55, 1.15, 1.75]) S.deck(u, 0.15, u + 0.08, 1.85, 2, '#c8b08a', false);       // finger pontoons
    const cols = ['#3d6fb0', '#d9534a', '#2e8f72', '#e0b526', '#6b5aa8', '#3d6fb0'];
    let n = 0;
    for (const u of [0.1, 0.68, 1.28]) for (const v of [0.35, 0.7, 1.3, 1.65]) { if (hash(n, 7, 3) < 0.2) { n++; continue; } boat(u, v, 0, cols[n % cols.length], n % 3 !== 1); n++; }
  };
  if (S.back) { sea(); land(); } else { land(); sea(); }
}
function ferryPier(k, face) {
  const { C, line, faces } = k, S = shoreKit(k, face, 1);
  const land = () => {
    S.quad(-1, 0, 0, 1, 0, '#bfc3c8');
    S.lsh(-0.85, 0.1, -0.35, 0.6, 16); S.lbox(-0.85, 0.1, -0.35, 0.6, 15, faces('#eef1f4'));        // ticket hall
    S.quad(-0.9, 0.05, -0.3, 0.65, 15, '#2f6fa8');
    S.quad(-0.35, 0.2, -0.34, 0.5, 9, k.mode === 2 ? '#ffe7a0' : '#7fb0d0', true);
    S.lbox(-0.3, 0.7, -0.05, 0.92, 9, faces('#9aa3ad'));                                            // shelter
    S.quad(-0.32, 0.68, -0.03, 0.94, 9, '#2f6fa8');
    S.person(-0.15, 0.6, 0, '#e0b526'); S.person(-0.2, 0.4, 0, '#d9534a');
  };
  const sea = () => {
    S.deck(-0.05, 0.25, 0.95, 0.75, 4, '#9a9fa6', true);
    S.lbox(0.8, 0.22, 0.95, 0.32, 9, faces('#2f6fa8'), 4); S.lbox(0.8, 0.68, 0.95, 0.78, 9, faces('#2f6fa8'), 4);   // ramp towers
    line(S.L(0.87, 0.27, 13), S.L(0.87, 0.73, 13), C('#2f6fa8'), 1.6);
  };
  if (S.back) { sea(); land(); } else { land(); sea(); }
}
function recycle(k) {
  const { P, poly, box, faces, sh, C, line, circ } = k;
  padRect(k, 2, 2, '#a9a493', ['#8a8574', '#bdb8a6']);
  const x = 0.15, y = 0.2, w = 1.2, d = 0.95, h = 36;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#d8e4dc', r: shade('#d8e4dc', 0.76), t: '#8f98a6' });
  poly([P(x, y + d, 20), P(x + w, y + d, 20), P(x + w, y + d, 25), P(x, y + d, 25)], C('#3a9d6e'));
  poly([P(x + 0.3, y + d, 5), P(x + 0.9, y + d, 5), P(x + 0.9, y + d, 19), P(x + 0.3, y + d, 19)], C('#3a9d6e'));
  for (const [a, b] of [[0.42, 0.62], [0.6, 0.78], [0.5, 0.7]]) line(P(x + a, y + d, 8 + (a - 0.42) * 30), P(x + b, y + d, 12 + (b - 0.6) * 20), '#fff', 1.8);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) poly([P(x + 0.1 + j * 0.34, y + 0.1 + i * 0.4, h), P(x + 0.38 + j * 0.34, y + 0.1 + i * 0.4, h), P(x + 0.38 + j * 0.34, y + 0.4 + i * 0.4, h), P(x + 0.1 + j * 0.34, y + 0.4 + i * 0.4, h)], C('#1f3a5f'));
  box(1.42, 0.25, 0.4, 0.3, 12, faces('#c9ccd2'));
  const bc = ['#3d8bd9', '#9aa0a8', '#3a9d6e', '#e0b526'];
  for (let i = 0; i < 6; i++) box(1.1 + (i % 3) * 0.22, 1.4 + Math.floor(i / 3) * 0.2, 0.2, 0.18, 8, faces(bc[i % 4]));
  box(0.2, 1.6, 0.5, 0.18, 7, faces('#3f8f5a')); box(0.2, 1.6, 0.16, 0.18, 5, faces('#f2f2f2'), 7);
}
function wte(k) {
  const { P, poly, box, faces, sh, C, line, cyl, circ } = k;
  padRect(k, 2, 2, '#a9a493', ['#8a8574', '#bdb8a6']);
  const x = 0.15, y = 0.5, w = 1.2, d = 0.9, h = 40;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#9aa3ad', r: shade('#9aa3ad', 0.76), t: '#6f7782' });
  poly([P(x, y + d, 22), P(x + w, y + d, 22), P(x + w, y + d, 27), P(x, y + d, 27)], C('#3a9d6e'));
  k.wins(x, y, w, d, h, 95, { dens: 2.4, rh: 12, wh: 5, base: 8 });
  poly([P(x + 0.4, y + d, 0), P(x + 0.8, y + d, 0), P(x + 0.8, y + d, 16), P(x + 0.4, y + d, 16)], C('#4a5568'));
  box(0.35, 0.18, 0.22, 0.22, 104, faces('#c9ccd2')); for (let z = 20; z < 104; z += 28) box(0.35, 0.18, 0.22, 0.22, 10, faces('#3a9d6e'), z);
  sh(0.35, 0.18, 0.22, 0.22, 110); k.smoke(P(0.46, 0.29, 110), 4);
  cyl(1.55, 0.45, 15, 30, '#cfd6de'); cyl(1.55, 0.45, 15.4, 5, '#3a9d6e', 20);
  for (let i = 0; i < 2; i++) { const px = 0.95 + i * 0.5; line(P(px, 0.2), P(px, 0.2, 52), C('#6b7280'), 1.6); line(P(px - 0.1, 0.2, 46), P(px + 0.1, 0.2, 46), C('#6b7280'), 1.4); line(P(px - 0.08, 0.2, 38), P(px + 0.08, 0.2, 38), C('#6b7280'), 1.2); }
  line(P(0.95, 0.2, 50), P(1.45, 0.2, 50), C('#2b2e36'), 0.9);
  box(1.4, 1.45, 0.4, 0.2, 7, faces('#3f8f5a'));
}

function pumpStation(k) {
  const { P, poly, box, faces, sh, C, line, cyl, ell, circ } = k;
  padRect(k, 2, 2, '#a9a493', ['#8a8574', '#bdb8a6']);
  const x = 0.12, y = 0.6, w = 1.0, d = 0.85, h = 30;
  sh(x, y, w, d, h);
  box(x, y, w, d, h, { l: '#b8856a', r: shade('#b8856a', 0.76), t: '#4f79a8' });
  k.wins(x, y, w, d, h, 97, { dens: 2.6, rh: 11, wh: 6, base: 9 });
  poly([P(x + 0.35, y + d, 0), P(x + 0.7, y + d, 0), P(x + 0.7, y + d, 17), P(x + 0.35, y + d, 17)], C('#4a5568'));
  poly([P(x + 0.1, y + 0.1, h), P(x + 0.55, y + 0.1, h), P(x + 0.55, y + 0.4, h), P(x + 0.1, y + 0.4, h)], C('#3d6fa8'));
  // manifold: pipes running from the hall to the tank, with flanges and a valve wheel
  for (const [z0, col] of [[3, '#aeb7c2'], [8, '#9aa6b3']]) { line(P(1.15, 1.0, z0), P(1.55, 0.7, z0), C(col), 4.4); line(P(1.15, 1.2, z0), P(1.55, 1.2, z0), C(col), 4.4); }
  line(P(1.55, 0.7, 3), P(1.55, 1.2, 3), C('#aeb7c2'), 4.4);
  for (const u of [1.2, 1.4]) box(u, 0.98, 0.07, 0.07, 9, faces('#6b7280'));
  circ(P(1.4, 1.2, 14), 3, C('#c9372c')); line(P(1.4, 1.2, 14), P(1.4, 1.2, 8), C('#555'), 1.2);
  sh(1.25, 0.15, 0.6, 0.6, 40);
  cyl(1.55, 0.45, 17, 36, '#cfd6de'); cyl(1.55, 0.45, 17.4, 6, '#3d8bd9', 20);
  line(P(1.4, 0.55, 0), P(1.4, 0.55, 34), C('#8b8f96'), 1);
  box(1.3, 1.45, 0.45, 0.4, 12, faces('#d3d7de')); box(1.34, 1.49, 0.37, 0.07, 6, faces('#3d8bd9'), 3);
  for (let i = 0; i <= 8; i++) { const u = i / 4; line(P(u, 1.97), P(u, 1.97, 6), C('#6b7280'), 0.7); line(P(1.97, u), P(1.97, u, 6), C('#6b7280'), 0.7); }
  line(P(0, 1.97, 6), P(2, 1.97, 6), C('#6b7280'), 0.8); line(P(1.97, 0, 6), P(1.97, 2, 6), C('#6b7280'), 0.8);
}
function treatmentPlant(k) {
  const { P, poly, box, faces, sh, C, line, cyl, ell, circ, tree, ctx } = k;
  padRect(k, 3, 3, '#b9d9a0', ['#4d8f3c', '#8fd070']);
  poly([P(0.1, 2.45), P(2.9, 2.45), P(2.9, 2.75), P(0.1, 2.75)], C('#d9cfae'), null, true);
  // main building with a blue band and a roof lantern
  sh(0.25, 0.3, 1.3, 0.85, 46);
  box(0.25, 0.3, 1.3, 0.85, 46, { l: '#e6edf2', r: shade('#e6edf2', 0.78), t: '#8d9aa8' });
  poly([P(0.25, 1.15, 20), P(1.55, 1.15, 20), P(1.55, 1.15, 27), P(0.25, 1.15, 27)], C('#3d8bd9'));
  k.wins(0.25, 0.3, 1.3, 0.85, 46, 98, { dens: 3, rh: 11, wh: 6, base: 30 });
  poly([P(0.5, 1.15, 0), P(0.95, 1.15, 0), P(0.95, 1.15, 17), P(0.5, 1.15, 17)], C(k.store()));
  box(0.55, 0.45, 0.6, 0.35, 8, faces('#cfd6de'), 46);
  // clarifier tanks (round basins with a sweeping arm)
  const basin = (x, y, r) => {
    const c = P(x, y);
    ell([c[0], c[1] + 3], r, r * 0.5, C('#9aa3ad')); ell([c[0], c[1] + 1], r, r * 0.5, C('#cfd6de')); ell([c[0], c[1]], r - 3, (r - 3) * 0.5, C('#4da6dc'));
    ell([c[0], c[1] - 0.5], r - 7, (r - 7) * 0.5, C('#62b6e6'));
    const a = ((k.mode === 0 ? 0.9 : 0.4)), ex = c[0] + Math.cos(a) * (r - 4), ey = c[1] + Math.sin(a) * (r - 4) * 0.5;
    line([c[0], c[1]], [ex, ey], C('#f2f2f2'), 1.6); circ([c[0], c[1]], 2, C('#6b7280'));
  };
  basin(2.2, 0.7, 36); basin(2.2, 1.55, 36);
  // filter beds
  for (let i = 0; i < 4; i++) { const x0 = 0.3 + i * 0.35, y0 = 1.55;
    box(x0, y0, 0.3, 0.7, 3, { l: '#cfd6de', r: '#aab3bd', t: '#cfd6de' });
    poly([P(x0 + 0.04, y0 + 0.05, 3), P(x0 + 0.26, y0 + 0.05, 3), P(x0 + 0.26, y0 + 0.65, 3), P(x0 + 0.04, y0 + 0.65, 3)], C(i % 2 ? '#62b6e6' : '#4da6dc'));
    line(P(x0 + 0.04, y0 + 0.35, 3.2), P(x0 + 0.26, y0 + 0.35, 3.2), 'rgba(255,255,255,.5)', 0.8); }
  // storage tanks and pipes
  sh(2.0, 2.2, 0.9, 0.9, 40);
  cyl(2.5, 2.6, 20, 38, '#cfd6de'); cyl(2.5, 2.6, 20.4, 6, '#3d8bd9', 22);
  line(P(1.6, 1.3, 3), P(1.85, 1.3, 3), C('#aeb7c2'), 4.4); line(P(1.85, 1.3, 3), P(1.85, 2.6, 3), C('#aeb7c2'), 4.4); line(P(1.85, 2.6, 3), P(2.2, 2.6, 3), C('#aeb7c2'), 4.4);
  line(P(1.55, 0.75, 4), P(1.95, 0.75, 4), C('#aeb7c2'), 3.6);
  box(2.75, 0.2, 0.16, 0.16, 74, faces('#e6e6e6')); for (let z = 16; z < 74; z += 20) box(2.75, 0.2, 0.16, 0.16, 8, faces('#3d8bd9'), z);
  circ(P(2.83, 0.28, 78), 2.2, '#7dffa0');
  tree(0.2, 2.85, 0, 21); tree(1.2, 2.9, 3, 22); tree(2.85, 2.85, 1, 23);
}

function busStop(k) {
  const { P, poly, box, faces, C, line, circ, cyl, sh } = k;
  padRect(k, 1, 1, '#cfd1d4', null);
  poly([P(0, 0.88), P(1, 0.88), P(1, 1), P(0, 1)], C('#8f959c'), null, true);
  sh(0.18, 0.3, 0.64, 0.34, 20);
  for (const [x, y] of [[0.2, 0.32], [0.78, 0.32], [0.2, 0.6], [0.78, 0.6]]) box(x - 0.02, y - 0.02, 0.04, 0.04, 17, faces('#5a6370'));
  poly([P(0.2, 0.32, 5), P(0.8, 0.32, 5), P(0.8, 0.32, 17), P(0.2, 0.32, 17)], 'rgba(150,200,230,.55)');
  poly([P(0.2, 0.32, 5), P(0.2, 0.62, 5), P(0.2, 0.62, 17), P(0.2, 0.32, 17)], 'rgba(150,200,230,.4)');
  box(0.14, 0.26, 0.72, 0.42, 2.2, { l: '#3d8bd9', r: '#2f6fb0', t: '#4e9be8' }, 17);
  box(0.3, 0.38, 0.4, 0.1, 2, { l: '#8a5a34', r: '#6b4426', t: '#a06a3c' }, 3); box(0.3, 0.38, 0.4, 0.02, 4, { l: '#8a5a34', r: '#6b4426', t: '#a06a3c' }, 5);
  poly([P(0.28, 0.66, 8), P(0.42, 0.66, 8), P(0.42, 0.66, 14), P(0.28, 0.66, 14)], C('#f4f1e8'));
  const pole = P(0.9, 0.78); line(pole, [pole[0], pole[1] - 24], C('#6b7280'), 1.4); circ([pole[0], pole[1] - 26], 5.5, C('#2e86c1'));
  k.ctx.fillStyle = '#fff'; k.ctx.fillRect(pole[0] - 3.2, pole[1] - 29, 6.4, 5); k.ctx.fillStyle = C('#2e86c1'); k.ctx.fillRect(pole[0] - 2.4, pole[1] - 27.6, 4.8, 1.6);
  cyl(0.12, 0.8, 2.6, 6, '#4a8f5a');
}
function busTerminal(k) {
  const { P, poly, box, faces, C, line, circ, sh } = k;
  padRect(k, 2, 2, '#50565f', ['#3f444c', '#666c75']);
  for (let i = 1; i < 4; i++) line(P(0.1 + i * 0.45, 0.95), P(0.1 + i * 0.45, 1.85), 'rgba(240,224,138,.85)', 1, [3, 2]);
  sh(0.1, 0.1, 1.8, 0.55, 34);
  box(0.1, 0.1, 1.8, 0.55, 34, { l: '#e6ecf1', r: shade('#e6ecf1', 0.76), t: '#8f9aa8' });
  poly([P(0.15, 0.65, 3), P(1.85, 0.65, 3), P(1.85, 0.65, 24), P(0.15, 0.65, 24)], C(k.store()));
  for (let i = 1; i < 9; i++) line(P(0.15 + i * 0.19, 0.65, 3), P(0.15 + i * 0.19, 0.65, 24), 'rgba(255,255,255,.5)', 0.7);
  poly([P(0.1, 0.65, 28), P(1.9, 0.65, 28), P(1.9, 0.65, 34), P(0.1, 0.65, 34)], C('#2e86c1'));
  // canopy over the bays
  for (const x of [0.15, 1.0, 1.85]) box(x - 0.03, 1.05, 0.06, 0.06, 20, faces('#6b7280'));
  box(0.05, 0.95, 1.9, 0.95, 2.5, { l: '#e8ecef', r: '#b9c0c8', t: '#d3d9df' }, 20);
  for (const [x, c] of [[0.2, '#e8a521'], [1.05, '#3a9d6e']]) { box(x, 1.2, 0.7, 0.22, 11, faces(c)); poly([P(x + 0.05, 1.42, 4), P(x + 0.65, 1.42, 4), P(x + 0.65, 1.42, 9), P(x + 0.05, 1.42, 9)], C('#cfe6f3')); }
  box(1.75, 0.8, 0.12, 0.12, 40, faces('#2e86c1')); poly([P(1.7, 0.92, 34), P(1.92, 0.92, 34), P(1.92, 0.92, 44), P(1.7, 0.92, 44)], C('#ffffff'));
}
const SVC_SPR_X = { 21: [busStop, 1, 1, 70], 22: [busTerminal, 2, 2, 100], 19: [pumpStation, 2, 2, 120], 20: [treatmentPlant, 3, 3, 130], 8: [policeHQ, 2, 2, 150], 9: [fireHQ, 2, 2, 170], 10: [hospital, 2, 2, 170], 11: [university, 3, 3, 190], 12: [plaza, 2, 2, 100], 13: [library, 1, 1, 100], 14: [museum, 2, 2, 130], 15: [stadium, 3, 3, 150], 16: [dump, 2, 2, 100], 17: [recycle, 2, 2, 100], 18: [wte, 2, 2, 170] };
const SVC_SPR_SHORE = { 23: [pier, 1, 1, 70, 2], 24: [beach, 2, 2, 60, 1], 25: [marina, 2, 2, 80, 2], 26: [ferryPier, 1, 1, 70, 1] };   // last number: tiles the picture reaches beyond its lot
const SVC_SPR = { ...SVC_SPR_SHORE, 1: [coalPlant, 2, 2, 190], 2: [wind, 1, 1, 130], 3: [waterTower, 1, 1, 130], 4: [police, 1, 1, 100], 5: [fireStation, 1, 1, 130], 6: [clinic, 1, 1, 110], 7: [school, 1, 1, 130], ...SVC_SPR_X };
export function serviceSprite(id, mode, lit = true, face = 0) {
  lit = mode === 2 ? !!lit : true;
  const e = SVC_SPR[id], pad = e[4] || 0;
  return memoLater(`s${id}${mode}${lit ? 1 : 0}${pad ? 'f' + face : ''}`, () => {
    const [fn, fw0, fd0, hh] = e, fw = fw0 + 2 * pad, fd = fd0 + 2 * pad;     // shore buildings get a bigger canvas for the part over the water
    const W = (fw + fd) * 32 + 96, ox = fd * 32 + 32, H = hh + (fw + fd) * 16 + 34, oy = H - (fw + fd) * 16 - 34 + pad * 32;
    return make(W, H, ox, oy, (k) => fn(k, face), mode, lit);
  });
}

// Smaller copies of a sprite for zoomed-out drawing (level 1 = half size, 2 = quarter size).
// Shrinking a big sprite to a few pixels every frame is slow on phones and makes edges shimmer;
// a pre-shrunk copy is cheaper to draw and smoother to look at.
export function mip(sp, level) {
  if (!level || !sp) return sp;
  const key = level === 1 ? 'm1' : 'm2';
  if (sp[key]) return sp[key];
  if (spriteBudget.left <= 0) return sp;                       // no time this frame: draw the full-size picture scaled down
  const t0 = performance.now();
  const r = mipMake(sp, level, key);
  spriteBudget.left -= performance.now() - t0; spriteBudget.made++;
  return r;
}
function mipMake(sp, level, key) {
  const src = level === 1 ? sp : (sp.m1 || mipMake(sp, 1, 'm1'));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.c.width / 2)); c.height = Math.max(1, Math.round(src.c.height / 2));
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(src.c, 0, 0, c.width, c.height);
  return (sp[key] = { c, ox: sp.ox, oy: sp.oy, S: src.S * (c.width / src.c.width) });
}

// ---------- bridges ----------
// A bridge tile is three layers: the structure under the deck (drawn first, over the water), the road deck
// (the normal road picture) and the railings on top. axis 0 runs along x, axis 1 along y.
// endN: the bridge stops at its lower, visible end; endF: it stops at its upper end; pillar: this tile has a pier.
const DECK = 7;
export function bridgeUnder(axis, pillar, endN, mode) {
  return memo(`bu${axis}${pillar}${endN}${mode}`, () => make(110, 64, 55, 0, (k) => {
    const { P, poly, C } = k;
    const side = axis === 0 ? (a, b, h) => P(a, 1 + b, h) : (a, b, h) => P(1 + b, a, h);   // along the near side
    const end = axis === 0 ? (a, b, h) => P(1 + b, a, h) : (a, b, h) => P(a, 1 + b, h);    // across the near end
    poly([side(0, 0, -DECK), side(1, 0, -DECK), side(1, 0.42, -DECK), side(0, 0.42, -DECK)], 'rgba(8,36,64,.2)', null, true);   // shadow on the water
    if (pillar) {
      const px = (h) => [side(0.38, 0, h), side(0.62, 0, h)];
      const [a0, b0] = px(-DECK), [a1, b1] = px(-DECK - 11);
      poly([a0, b0, b1, a1], C('#9d978c'), null, true);
      poly([b0, side(0.62, -0.12, -DECK), side(0.62, -0.12, -DECK - 11), b1], C('#857f74'), null, true);
      k.ell(side(0.5, 0.05, -DECK - 11), 5.5, 1.6, 'rgba(255,255,255,.35)');               // ripple where the pier meets the water
    }
    poly([side(0, 0, 0), side(1, 0, 0), side(1, 0, -DECK), side(0, 0, -DECK)], C('#b9b3a6'), null, true);
    poly([side(0, 0, -DECK + 1.6), side(1, 0, -DECK + 1.6), side(1, 0, -DECK), side(0, 0, -DECK)], C('#958f83'), null, true);
    if (endN) poly([end(0, 0, 0), end(1, 0, 0), end(1, 0, -DECK), end(0, 0, -DECK)], C('#a39d90'), null, true);
  }, mode));
}
export function bridgeTop(axis, endN, endF, mode) {
  return memo(`bt${axis}${endN ? 1 : 0}${endF ? 1 : 0}${mode}`, () => make(64, 40, 32, 5, (k) => {
    const { P, poly, C, line } = k;
    const H = 3.2, wall = (a, b) => {                       // a low concrete parapet with posts
      poly([a(0), b(0), b(H), a(H)], C('#d7d1c4'), null, true);
      line(a(H), b(H), C('#f1ece1'), 0.8);
    };
    const far = axis === 0 ? (t) => (h) => P(t, 0.04, h) : (t) => (h) => P(0.04, t, h);
    const near = axis === 0 ? (t) => (h) => P(t, 0.96, h) : (t) => (h) => P(0.96, t, h);
    wall(far(0), far(1));
    if (endF) wall(axis === 0 ? (h) => P(0.04, 0, h) : (h) => P(0, 0.04, h), axis === 0 ? (h) => P(0.04, 1, h) : (h) => P(1, 0.04, h));
    if (endN) wall(axis === 0 ? (h) => P(0.96, 0, h) : (h) => P(0, 0.96, h), axis === 0 ? (h) => P(0.96, 1, h) : (h) => P(1, 0.96, h));
    wall(near(0), near(1));
    for (const t of [0.25, 0.75]) line(near(t)(0), near(t)(H + 0.6), C('#a8a296'), 0.9);
  }, mode));
}
