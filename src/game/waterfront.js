// Waterfront buildings. A homes, shops or industry lot within 2 tiles of water grows one of these instead of
// the inland design, and the look depends on how big the water is (world.shore):
//   pond  - a quiet garden village: thatched cottages, a tea house, a watermill
//   lake  - timber lake country: log cabins, boathouses, lodges, barge wharfs
//   sea   - the seaside: beach cottages on stilts, resorts, fishing wharfs and container harbors
// Every picture is drawn once and cached as a sprite (see sprites.js), like the inland buildings.
import { shade, hash, lerp } from './util.js';
import { T, SHORE } from './world.js';

// ---------- small shared pieces ----------
function gable(k, x, y, w, d, h, rh, wall, roof, z0 = 0) {
  const { P, poly, box, faces, C, line } = k;
  const f = faces(wall), ym = y + d / 2, top = z0 + h;
  const pos = (u, t) => P(x + w * u, lerp(y + d, ym, t), top + rh * t);
  box(x, y, w, d, h, f, z0);
  poly([P(x, y, top), P(x + w, y, top), P(x + w, ym, top + rh), P(x, ym, top + rh)], C(shade(roof, 0.8)));
  poly([P(x + w, y, top), P(x + w, y + d, top), P(x + w, ym, top + rh)], C(f.r), 'v');
  poly([pos(0, 0), pos(1, 0), pos(1, 1), pos(0, 1)], C(roof), 'v');
  for (let i = 1; i < 6; i++) line(pos(0, i / 6), pos(1, i / 6), 'rgba(0,0,0,.16)', 0.5);
  return pos;
}
function hip(k, x, y, w, d, z, rh, roof, inset = 0.12) {       // a hipped roof, like a tea house or a pavilion
  const { P, poly, C } = k;
  const a = P(x + inset, y + inset, z + rh), b = P(x + w - inset, y + inset, z + rh), c = P(x + w - inset, y + d - inset, z + rh), e = P(x + inset, y + d - inset, z + rh);
  poly([P(x, y, z), P(x + w, y, z), b, a], C(shade(roof, 0.8)));
  poly([P(x, y, z), a, e, P(x, y + d, z)], C(shade(roof, 0.85)));
  poly([P(x + w, y, z), P(x + w, y + d, z), c, b], C(shade(roof, 0.78)), 'v');
  poly([P(x, y + d, z), P(x + w, y + d, z), c, e], C(roof), 'v');
  if (inset < 0.5) poly([a, b, c, e], C(shade(roof, 1.08)));
}
function deck(k, x, y, w, d, z, col = '#a8774a') {
  const { P, box, faces, line } = k;
  box(x, y, w, d, 1.6, faces(col), z);
  for (let i = 1; i < 8; i++) { const u = x + (w * i) / 8; line(P(u, y, z + 1.6), P(u, y + d, z + 1.6), 'rgba(60,35,15,.3)', 0.5); }
}
function posts(k, x, y, w, d, z, col = '#6b4a2f') {          // stilts or deck posts at the visible corners
  const { P, line, C } = k;
  for (const [a, b] of [[x, y + d], [x + w, y + d], [x + w, y], [x + w / 2, y + d]]) line(P(a, b, 0), P(a, b, z), C(col), 1.6);
}
function rail(k, x, y, w, d, z, col = '#f4efe6') {             // railing along the two front edges
  const { P, line, C } = k;
  line(P(x, y + d, z + 5), P(x + w, y + d, z + 5), C(col), 0.9); line(P(x + w, y, z + 5), P(x + w, y + d, z + 5), C(col), 0.9);
  for (let i = 0; i <= 6; i++) { line(P(x + (w * i) / 6, y + d, z), P(x + (w * i) / 6, y + d, z + 5), C(col), 0.5); line(P(x + w, y + (d * i) / 6, z), P(x + w, y + (d * i) / 6, z + 5), C(col), 0.5); }
}
function balconies(k, x, y, w, d, z0, z1, step, col, glass) {   // a balcony slab on every floor, with glass or metal rails
  const { P, poly, C, line } = k;
  for (let z = z0; z < z1; z += step) {
    poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d + 0.06, z - 1.5), P(x, y + d + 0.06, z - 1.5)], C(col));
    poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w + 0.06, y + d, z - 1.5), P(x + w + 0.06, y, z - 1.5)], C(shade(col, 0.85)));
    if (glass) {
      poly([P(x, y + d + 0.06, z - 1.5), P(x + w, y + d + 0.06, z - 1.5), P(x + w, y + d + 0.06, z + 3.5), P(x, y + d + 0.06, z + 3.5)], 'rgba(170,220,240,.45)', null, true);
      poly([P(x + w + 0.06, y, z - 1.5), P(x + w + 0.06, y + d, z - 1.5), P(x + w + 0.06, y + d, z + 3.5), P(x + w + 0.06, y, z + 3.5)], 'rgba(150,200,225,.45)', null, true);
    } else line(P(x, y + d + 0.06, z + 2.5), P(x + w, y + d + 0.06, z + 2.5), C('#5a6470'), 0.6);
  }
}
function umbrella(k, x, y, col, z = 0, r = 6) {
  const { P, line, C, ctx } = k;
  const p = P(x, y, z), t = [p[0], p[1] - 10];
  line(p, t, C('#7a6a58'), 0.9);
  ctx.beginPath(); ctx.moveTo(t[0] - r, t[1] + 2); ctx.quadraticCurveTo(t[0], t[1] - 6, t[0] + r, t[1] + 2); ctx.closePath(); ctx.fillStyle = C(col); ctx.fill();
  ctx.beginPath(); ctx.moveTo(t[0] - r * 0.35, t[1] + 1); ctx.quadraticCurveTo(t[0], t[1] - 5, t[0] + r * 0.35, t[1] + 1); ctx.closePath(); ctx.fillStyle = C('#ffffff'); ctx.fill();
}
function table(k, x, y, z = 0) { const { P, ell, C, line } = k; const p = P(x, y, z); line(p, [p[0], p[1] - 3], C('#555'), 0.8); ell([p[0], p[1] - 3], 2.6, 1.2, C('#f2f2ee')); }
function palm(k, x, y, sd) {
  const { P, C, ctx, ell, mode } = k;
  const lean = (hash(sd, 2, 3) - 0.5) * 8;
  { // 0.8.8: keep the fronds over the lot (palms right at a side corner spread over the next lot or the road)
    const d = x - y, lim = (32 - 13 - Math.abs(lean)) / 32;
    if (Math.abs(d) > lim) { const e = (d - Math.sign(d) * lim) / 2; x -= e; y += e; }
  }
  const p = P(x, y), tx = p[0] + lean, ty = p[1] - 28;
  ctx.strokeStyle = C('#8a6a44'); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[0] - lean * 0.2, p[1] - 15, tx, ty); ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.283 + sd, ex = tx + Math.cos(a) * 11, ey = ty + Math.sin(a) * 4 + 4;
    ctx.strokeStyle = C(i % 2 ? '#2f8a4a' : '#45a85e'); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + ex) / 2, ty - 5, ex, ey); ctx.stroke();
  }
}
function flowers(k, sd, n = 8, area = [0.05, 0.05, 0.9, 0.9]) {
  const { P, circ, C } = k;
  for (let i = 0; i < n; i++) circ(P(area[0] + hash(sd, i, 1) * area[2], area[1] + hash(sd, i, 2) * area[3]), 1.3, C(['#e86f9b', '#f4c542', '#ffffff', '#b57be0', '#ff8a5c'][i % 5]));
}
function hedge(k, x0, y0, x1, y1, z = 4) { const { P, poly, C } = k; poly([P(x0, y0), P(x1, y1), P(x1, y1, z), P(x0, y0, z)], C('#3f7f34')); line2(k, P(x0, y0, z), P(x1, y1, z), '#5aa045'); }
function line2(k, a, b, col) { k.line(a, b, k.C(col), 1.2); }
function fence(k, x0, y0, x1, y1, col = '#f6f1e6') {             // a picket fence
  const { P, line, C } = k;
  line(P(x0, y0, 3.5), P(x1, y1, 3.5), C(col), 0.8);
  for (let i = 0; i <= 10; i++) { const t = i / 10; line(P(lerp(x0, x1, t), lerp(y0, y1, t), 0), P(lerp(x0, x1, t), lerp(y0, y1, t), 5), C(col), 0.7); }
}
function lights(k, a, b, sag = 4) {                              // a string of festoon lights
  const { ctx, circ, mode, lit } = k;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2, b[0], b[1]); ctx.strokeStyle = 'rgba(40,40,40,.6)'; ctx.lineWidth = 0.5; ctx.stroke();
  const on = mode === 2 && lit;
  for (let i = 1; i < 8; i++) { const t = i / 8, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t) + sag * 2 * 2 * t * (1 - t); circ([x, y], on ? 1.3 : 0.9, on ? '#ffe39a' : k.C('#f6e7b5')); }
}
function basin(k, x, y, w, d) {                                  // a harbor basin cut into the lot, with a quay edge
  const { P, poly, C, line, ctx } = k;
  const a = [P(x, y), P(x + w, y), P(x + w, y + d), P(x, y + d)];
  poly(a, C('#2f86b8'), null, true);
  const g = ctx.createLinearGradient(a[0][0], a[0][1], a[2][0], a[2][1]); g.addColorStop(0, 'rgba(10,40,70,.35)'); g.addColorStop(1, 'rgba(255,255,255,.12)');
  k.path(a); ctx.fillStyle = g; ctx.fill();
  for (let i = 0; i < 5; i++) { const u = x + w * (0.1 + hash(i, 3, 3) * 0.8), v = y + d * (0.2 + hash(i, 4, 4) * 0.7); line(P(u, v), P(u + 0.06, v), 'rgba(255,255,255,.4)', 0.7); }
  poly([P(x, y, 0), P(x + w, y, 0), P(x + w, y, -4), P(x, y, -4)], C('#8d949c'), null, true);       // the quay wall you see across the water
  line(P(x, y, 0), P(x + w, y, 0), C('#e6e2d6'), 1.2);
}
function boat(k, x, y, l, bw, col, o = {}) {                     // a hull along x, bow pointing +x
  const { P, poly, C, box, faces, line } = k;
  const h = o.h || 4, top = [P(x, y, h), P(x + l, y, h), P(x + l + bw * 0.7, y + bw / 2, h), P(x + l, y + bw, h), P(x, y + bw, h)];
  poly([P(x, y + bw, 0), P(x + l, y + bw, 0), P(x + l + bw * 0.7, y + bw / 2, 0), P(x + l + bw * 0.7, y + bw / 2, h), P(x + l, y + bw, h), P(x, y + bw, h)], C(col));
  poly(top, C(o.deck || '#eae3d2'));
  line(P(x, y + bw, h), P(x + l, y + bw, h), C('#ffffff'), 0.7);
  if (o.cabin) box(x + l * 0.15, y + bw * 0.2, l * 0.35, bw * 0.6, o.cabin, faces(o.cabinCol || '#f4f4f0'), h);
  if (o.mast) { const m = P(x + l * 0.6, y + bw / 2, h); line(m, [m[0], m[1] - o.mast], C('#d8d2c4'), 0.9); if (o.boom) line([m[0], m[1] - o.mast * 0.8], P(x + l * 0.15, y + bw / 2, h + 4), C('#d8d2c4'), 0.5); }
}
function container(k, x, y, z, col) { k.box(x, y, 0.22, 0.1, 7, k.faces(col), z); k.line(k.P(x + 0.11, y + 0.1, z), k.P(x + 0.11, y + 0.1, z + 7), 'rgba(0,0,0,.25)', 0.5); }
function crate(k, x, y, z = 0, col = '#b88a52') { k.box(x, y, 0.07, 0.07, 4.5, k.faces(col), z); }
function jibCrane(k, x, y, h, col, reachX, reachY) {
  const { P, line, C, box, faces } = k;
  box(x - 0.03, y - 0.03, 0.06, 0.06, h, faces(col));
  box(x - 0.05, y - 0.05, 0.1, 0.1, 6, faces(shade(col, 0.9)), h);
  const top = P(x, y, h + 6), tip = P(x + reachX, y + reachY, h + 2);
  line(top, tip, C(col), 1.8); line(P(x, y, h + 14), tip, C('#555'), 0.5); line(P(x, y, h + 14), P(x - 0.15, y - 0.1, h + 4), C('#555'), 0.5);
  line(tip, [tip[0], tip[1] + 18], C('#333'), 0.5);
}
function gantry(k, x, y, h, col, boomY0, boomY1) {               // ship-to-shore container crane: legs on the quay, boom over the water
  const { P, box, faces, line, C } = k;
  const f = faces(col);
  for (const [a, b] of [[x, y], [x + 0.2, y], [x, y + 0.2], [x + 0.2, y + 0.2]]) box(a, b, 0.035, 0.035, h, f);
  box(x, y, 0.235, 0.035, 4, f, h * 0.55); box(x, y + 0.2, 0.235, 0.035, 4, f, h * 0.55);
  box(x - 0.01, boomY0, 0.255, boomY1 - boomY0, 5, f, h);
  box(x + 0.06, y + 0.04, 0.12, 0.14, 8, faces('#f2f2ee'), h + 5);
  line(P(x + 0.12, y + 0.1, h + 13), P(x + 0.12, boomY1, h + 5), C('#444'), 0.5);
  line(P(x + 0.12, y + 0.1, h + 13), P(x + 0.12, boomY0, h + 5), C('#444'), 0.5);
}
function pool(k, x, y, w, d, z) {
  const { P, poly, C, line } = k;
  poly([P(x - 0.03, y - 0.03, z), P(x + w + 0.03, y - 0.03, z), P(x + w + 0.03, y + d + 0.03, z), P(x - 0.03, y + d + 0.03, z)], C('#f1ede4'), null, true);
  poly([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)], C('#4fc6e0'), null, true);
  line(P(x + w * 0.2, y + d * 0.4, z), P(x + w * 0.5, y + d * 0.4, z), 'rgba(255,255,255,.7)', 0.6);
  line(P(x + w * 0.45, y + d * 0.7, z), P(x + w * 0.8, y + d * 0.7, z), 'rgba(255,255,255,.6)', 0.6);
}
function lounger(k, x, y, z, col) { const { P, poly, C } = k; poly([P(x, y, z + 1), P(x + 0.1, y, z + 1), P(x + 0.1, y + 0.04, z + 1), P(x, y + 0.04, z + 1)], C(col), null, true); }
function crown(k, x, y, z, h = 16) { const { P, line, circ, C } = k; const p = P(x, y, z); line(p, [p[0], p[1] - h], C('#c9d3de'), 1.1); circ([p[0], p[1] - h - 1], 1.8, '#ff3b30'); }

const PASTEL = ['#9fd8d6', '#f6c6b4', '#f7e3a1', '#c7d9f2'];
const THATCH = ['#c9a25f', '#b89552', '#5e7a64', '#a35a44'];
const CREAM = ['#f3ead6', '#efe0c6', '#e8efe2', '#f2e1e1'];
const TIMBER = ['#9b6a42', '#8a5a3a', '#a8744a', '#7c5236'];
const LROOF = ['#3f5a3a', '#8d3b2f', '#2f4a5e', '#5a4636'];

// ================= POND: a quiet garden village =================
function pondCottage(k, v) {
  const { P, C, sh, win, line, circ } = k;
  k.pad('#9fd38a', ['#4d8f3c', '#8fd070', '#3f7f34']);
  k.tree(0.12, 0.12, 3, v + 3);
  const x = 0.2, y = 0.16, w = 0.52, d = 0.46;
  sh(x, y, w, d, 30);
  const pos = gable(k, x, y, w, d, 18, 17, CREAM[v % 4], THATCH[v % 4]);
  k.box(x + w * 0.72, y + 0.06, 0.08, 0.08, 16, k.faces('#9c8a7a'), 18);
  win([P(x + 0.08, y + d, 6), P(x + 0.18, y + d, 6), P(x + 0.18, y + d, 13), P(x + 0.08, y + d, 13)], hash(v, 1, 2), 0);
  win([P(x + w, y + 0.12, 6), P(x + w, y + 0.24, 6), P(x + w, y + 0.24, 13), P(x + w, y + 0.12, 13)], hash(v, 2, 2), 1);
  k.poly([P(x + 0.3, y + d, 0), P(x + 0.39, y + d, 0), P(x + 0.39, y + d, 12), P(x + 0.3, y + d, 12)], C(['#3f6f8f', '#6b4430', '#4c7a5a', '#8d4b3c'][v % 4]));
  for (let i = 0; i < 5; i++) circ(P(x + 0.02 + i * 0.12, y + d + 0.02, 2 + (i % 2)), 2.2, C(i % 2 ? '#5aa045' : '#4b8f3a'));   // climbing roses
  for (let i = 0; i < 5; i++) circ(P(x + 0.04 + i * 0.12, y + d + 0.02, 5), 0.9, C('#e86f9b'));
  fence(k, 0.05, 0.95, 0.95, 0.95); fence(k, 0.95, 0.05, 0.95, 0.95);
  flowers(k, v + 7, 9, [0.1, 0.72, 0.8, 0.18]);
  k.poly([P(0.4, 0.62), P(0.48, 0.62), P(0.48, 0.95), P(0.4, 0.95)], C('#d9cfae'), null, true);
}
function pondHouses(k, v) {
  const { sh, wins } = k;
  k.pad('#a5d58f', ['#4d8f3c', '#8fd070']);
  k.tree(0.14, 0.14, 3, v + 1);
  sh(0.54, 0.1, 0.38, 0.38, 40); sh(0.1, 0.54, 0.38, 0.38, 40);
  gable(k, 0.54, 0.1, 0.38, 0.38, 26, 14, CREAM[(v + 1) % 4], THATCH[(v + 2) % 4]);       // two cottages side by side
  wins(0.54, 0.1, 0.38, 0.38, 26, v + 5, { dens: 3, rh: 11, wh: 6, base: 5 });
  gable(k, 0.1, 0.54, 0.38, 0.38, 28, 15, PASTEL[v % 4], THATCH[(v + 3) % 4]);
  wins(0.1, 0.54, 0.38, 0.38, 28, v + 6, { dens: 3, rh: 11, wh: 6, base: 5 });
  hedge(k, 0.52, 0.56, 0.95, 0.56); flowers(k, v + 3, 8, [0.55, 0.6, 0.38, 0.35]);
}
function pondTerraces(k, v) {
  const { P, poly, C, sh, circ } = k;
  const wall = ['#efe6d6', '#e4dccb', '#ece3dc', '#e2e6dc'][v % 4], f = k.faces(wall);
  k.pad('#9fd38a', ['#4d8f3c', '#8fd070']);
  sh(0.12, 0.12, 0.76, 0.72, 58);
  const steps = [[0.12, 0.32, 58], [0.44, 0.2, 40], [0.64, 0.2, 22]];
  for (const [y, d, h] of steps) {
    k.box(0.12, y, 0.76, d, h, f);
    k.wins(0.12, y, 0.76, d, h, v + y * 10, { dens: 3.4, rh: 9, wh: 5, base: 5 });
    poly([P(0.12, y, h), P(0.88, y, h), P(0.88, y + 0.06, h), P(0.12, y + 0.06, h)], C('#a07a52'), null, true);
    for (let i = 0; i < 6; i++) circ(P(0.17 + i * 0.13, y + d - 0.02, h + 3), 2.6, C(i % 2 ? '#56a845' : '#3f8f3a'));   // planters on every terrace
  }
  for (let z = 6; z < 50; z += 8) circ(P(0.88, 0.2 + (z % 3) * 0.05, z), 2, C('#4b8f3a'));                            // ivy on the side wall
}
function pondGardenTower(k, v) {
  const { P, C, sh, circ, box } = k;
  const x = 0.2, y = 0.2, w = 0.6, d = 0.6, h = 150, f = k.faces(['#d9d2c4', '#cfc8bb', '#d6d0c8', '#cbd0c6'][v % 4]);
  k.pad('#9fd38a', ['#4d8f3c', '#8fd070']);
  sh(x, y, w, d, h);
  box(x, y, w, d, h, f);
  k.wins(x, y, w, d, h, v + 61, { dens: 3.4, rh: 12, wh: 6, base: 10 });
  balconies(k, x, y, w, d, 12, h, 12, '#e8e2d6', false);
  for (let z = 12; z < h; z += 12) for (let i = 0; i < 4; i++) {              // trees and shrubs on the balconies: a vertical forest
    const r = 2.2 + hash(v, z, i) * 2.2;
    if (hash(v, z, i + 3) > 0.35) circ(P(x + 0.06 + i * 0.17, y + d + 0.06, z + r), r, C(['#3f8f3a', '#56a845', '#6cba58'][(i + z) % 3]));
    if (hash(v, z, i + 7) > 0.4) circ(P(x + w + 0.06, y + 0.06 + i * 0.17, z + r), r, C(['#3a8634', '#4f9e40'][(i + z) % 2]));
  }
  box(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 3, k.faces('#7fb069'), h);
  k.tree(x + 0.2, y + 0.2, 0, v + 2); k.tree(x + 0.42, y + 0.36, 3, v + 4);
  crown(k, x + w - 0.1, y + 0.1, h + 3);
}
function pondTeaHouse(k, v) {
  const { P, C, sh, box, faces, circ } = k;
  k.pad('#a9d995', ['#4d8f3c', '#8fd070']);
  k.poly([P(0.08, 0.08), P(0.92, 0.08), P(0.92, 0.92), P(0.08, 0.92)], C('#e2d6b8'), null, true);   // gravel court
  sh(0.22, 0.2, 0.5, 0.44, 30);
  box(0.18, 0.16, 0.58, 0.52, 3, faces('#a8774a'));
  box(0.24, 0.22, 0.46, 0.4, 16, faces(['#f4efe2', '#efe7d4', '#f2eadf', '#ebe6da'][v % 4]), 3);
  k.poly([P(0.3, 0.62, 3), P(0.62, 0.62, 3), P(0.62, 0.62, 15), P(0.3, 0.62, 15)], k.store());
  for (let i = 1; i < 4; i++) k.line(P(0.3 + i * 0.08, 0.62, 3), P(0.3 + i * 0.08, 0.62, 15), C('#6b4a2f'), 0.7);
  hip(k, 0.14, 0.12, 0.66, 0.6, 19, 7, ['#3d4d5c', '#7a2e2a', '#3f5a3a', '#2f3e4c'][v % 4], 0.14);
  hip(k, 0.3, 0.27, 0.34, 0.3, 26, 9, ['#3d4d5c', '#7a2e2a', '#3f5a3a', '#2f3e4c'][v % 4], 0.17);
  for (let i = 0; i < 5; i++) circ(P(0.2 + i * 0.14, 0.72, 17), 1.8, C('#e04848'));           // paper lanterns
  table(k, 0.3, 0.82); table(k, 0.55, 0.84); table(k, 0.82, 0.55);
  k.tree(0.88, 0.14, 2, v + 4); flowers(k, v, 6, [0.1, 0.84, 0.8, 0.1]);
}
function pondCafe(k, v) {
  const { P, C, sh } = k;
  k.pad('#cfd1d4', null);
  sh(0.1, 0.1, 0.5, 0.42, 40);
  gable(k, 0.1, 0.1, 0.5, 0.42, 26, 14, ['#c98a72', '#b8785e', '#d09a7a', '#a86a58'][v % 4], '#5a4a44');
  k.wins(0.1, 0.1, 0.5, 0.42, 26, v + 15, { dens: 3, rh: 11, wh: 6, base: 13 });
  k.poly([P(0.14, 0.52, 1), P(0.56, 0.52, 1), P(0.56, 0.52, 11), P(0.14, 0.52, 11)], k.store());
  // the glass conservatory where people sit
  k.box(0.62, 0.14, 0.28, 0.4, 16, { l: '#cfe8f2', r: '#b6d6e6', t: '#e4f3f8' });
  k.poly([P(0.62, 0.54, 0), P(0.9, 0.54, 0), P(0.9, 0.54, 16), P(0.62, 0.54, 16)], 'rgba(0,0,0,0)', 'glass', true);
  for (let i = 1; i < 4; i++) { k.line(P(0.62 + i * 0.07, 0.54, 0), P(0.62 + i * 0.07, 0.54, 16), C('#ffffff'), 0.6); k.line(P(0.9, 0.14 + i * 0.1, 0), P(0.9, 0.14 + i * 0.1, 16), C('#ffffff'), 0.6); }
  hip(k, 0.62, 0.14, 0.28, 0.4, 16, 6, '#d8eef6', 0.1);
  umbrella(k, 0.25, 0.75, '#2e86c1'); umbrella(k, 0.5, 0.82, '#27ae60'); umbrella(k, 0.78, 0.76, '#e67e22');
  table(k, 0.25, 0.75); table(k, 0.5, 0.82); table(k, 0.78, 0.76);
  k.circ(P(0.06, 0.6, 3), 3, C('#4b8f3a')); k.circ(P(0.94, 0.9, 3), 3, C('#4b8f3a'));
}
function pondInn(k, v) {
  const { P, C, sh, line } = k;
  const x = 0.12, y = 0.12, w = 0.68, d = 0.48, h = 44;
  k.pad('#b9d9a0', ['#4d8f3c', '#8fd070']);
  sh(x, y, w, d, h + 20);
  gable(k, x, y, w, d, h, 20, '#f4efe2', ['#5a4a44', '#3d4d5c', '#7a3e2e', '#4a5a46'][v % 4]);
  for (let z = 0; z <= h; z += 14) line(P(x, y + d, z), P(x + w, y + d, z), C('#5a3d26'), 1.1);            // timber frame
  for (let i = 0; i <= 6; i++) line(P(x + (w * i) / 6, y + d, 0), P(x + (w * i) / 6, y + d, h), C('#5a3d26'), 1);
  for (let i = 0; i < 6; i++) line(P(x + (w * i) / 6, y + d, 14), P(x + (w * (i + 1)) / 6, y + d, 28), C('#5a3d26'), 0.8);
  for (let z = 0; z <= h; z += 14) line(P(x + w, y, z), P(x + w, y + d, z), C('#4a3220'), 1);
  k.wins(x, y, w, d, h, v + 25, { dens: 3, rh: 14, wh: 6, base: 18 });
  k.poly([P(x + 0.06, y + d, 1), P(x + 0.4, y + d, 1), P(x + 0.4, y + d, 10), P(x + 0.06, y + d, 10)], k.store());
  k.box(x + w - 0.14, y + 0.06, 0.09, 0.09, 26, k.faces('#8a7a6a'), h);
  const s = P(x + w + 0.02, y + d - 0.05, 30); line(s, [s[0] + 7, s[1] - 3], C('#3a2a1a'), 1); k.box(x + w + 0.04, y + d - 0.12, 0.02, 0.1, 7, k.faces('#a8423a'), 22);   // hanging sign
  umbrella(k, 0.3, 0.82, '#2f7a3a'); umbrella(k, 0.62, 0.84, '#2f7a3a'); table(k, 0.3, 0.82); table(k, 0.62, 0.84);
  k.tree(0.9, 0.2, 0, v + 4);
}
function pondHotel(k, v) {
  const { P, C, sh, box, circ, line } = k;
  const x = 0.14, y = 0.14, w = 0.72, d = 0.66, h = 100, wall = ['#efe3cc', '#e9ddd0', '#e6e2d4', '#f0e4d8'][v % 4];
  k.pad('#b9d9a0', ['#4d8f3c', '#8fd070']);
  sh(x, y, w, d, h + 20);
  box(x, y, w, d, h, k.faces(wall));
  k.wins(x, y, w, d, h, v + 35, { dens: 3, rh: 12, wh: 7, base: 18 });
  for (let z = 14; z < h; z += 12) line(P(x, y + d, z), P(x + w, y + d, z), 'rgba(0,0,0,.1)', 0.6);
  k.poly([P(x + 0.08, y + d, 1), P(x + w - 0.08, y + d, 1), P(x + w - 0.08, y + d, 12), P(x + 0.08, y + d, 12)], k.store());
  k.poly([P(x + 0.06, y + d, 15), P(x + w - 0.06, y + d, 15), P(x + w - 0.06, y + d + 0.13, 11), P(x + 0.06, y + d + 0.13, 11)], C('#2f6a44'));
  box(x - 0.02, y - 0.02, w + 0.04, d + 0.04, 3, k.faces(shade(wall, 0.85)), h);
  box(x + 0.04, y + 0.04, w - 0.08, d - 0.08, 2, k.faces('#7fb069'), h + 3);                                // roof garden
  for (let i = 0; i < 4; i++) { const a = P(x + 0.12 + i * 0.15, y + 0.12, h + 5), b = P(x + 0.12 + i * 0.15, y + 0.4, h + 5); line(a, [a[0], a[1] - 9], C('#f4efe2'), 1); line(b, [b[0], b[1] - 9], C('#f4efe2'), 1); }
  line(P(x + 0.12, y + 0.12, h + 14), P(x + 0.57, y + 0.12, h + 14), C('#f4efe2'), 1.2); line(P(x + 0.12, y + 0.4, h + 14), P(x + 0.57, y + 0.4, h + 14), C('#f4efe2'), 1.2);   // pergola
  for (let i = 0; i < 3; i++) circ(P(x + 0.55 + (i % 2) * 0.08, y + 0.5 + i * 0.04, h + 8), 3.4, C('#4b9a3f'));
  for (let i = 0; i < 3; i++) { const p = P(x + w + 0.01, y + 0.15 + i * 0.2, h); line(p, [p[0], p[1] - 14], C('#c9d3de'), 0.7); k.poly([[p[0], p[1] - 14], [p[0] + 6, p[1] - 12], [p[0], p[1] - 10]], C(['#e04848', '#2e86c1', '#f4c542'][i])); }
}
function pondMill(k, v) {
  const { P, C, sh, ctx, line } = k;
  k.pad('#a9c98f', ['#4d8f3c', '#8fd070']);
  basin(k, 0.76, 0.06, 0.2, 0.9);                                                 // the millrace
  sh(0.12, 0.14, 0.56, 0.5, 40);
  k.box(0.12, 0.14, 0.56, 0.5, 14, k.faces('#a8a296'));                            // stone ground floor
  for (let i = 0; i < 12; i++) line(P(0.12 + hash(i, 1, 1) * 0.5, 0.64, 3 + hash(i, 2, 1) * 9), P(0.17 + hash(i, 1, 1) * 0.5, 0.64, 3 + hash(i, 2, 1) * 9), 'rgba(0,0,0,.2)', 0.6);
  gable(k, 0.12, 0.14, 0.56, 0.5, 14, 18, TIMBER[v % 4], '#5a4a44', 14);
  k.wins(0.12, 0.14, 0.56, 0.5, 28, v + 45, { dens: 2.2, rh: 12, wh: 6, base: 17 });
  k.poly([P(0.2, 0.64, 0), P(0.34, 0.64, 0), P(0.34, 0.64, 11), P(0.2, 0.64, 11)], C('#5a3d26'));
  const c = P(0.72, 0.42, 16);                                                     // the water wheel turns in the race
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(-0.46);
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 16, 0, 0, 6.283); ctx.strokeStyle = C('#5a3d26'); ctx.lineWidth = 2.2; ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 16); ctx.strokeStyle = C('#7a5436'); ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
  for (let i = 0; i < 4; i++) k.box(0.2 + i * 0.09, 0.74, 0.07, 0.06, 3.5, k.faces('#d9c79a'));                // flour sacks
}
function pondBrewery(k, v) {
  const { sh } = k;
  k.pad('#b2ae9c', ['#8a8574', '#bdb8a6']);
  sh(0.08, 0.1, 0.5, 0.56, 42);
  gable(k, 0.08, 0.1, 0.5, 0.56, 30, 14, ['#a8573f', '#9c5a46', '#b0644a', '#8f4f3e'][v % 4], '#4a4a4f');
  k.wins(0.08, 0.1, 0.5, 0.56, 30, v + 55, { dens: 2.4, rh: 12, wh: 7, base: 6 });
  k.poly([k.P(0.18, 0.66, 0), k.P(0.4, 0.66, 0), k.P(0.4, 0.66, 14), k.P(0.18, 0.66, 14)], k.C('#3a3a3a'));
  k.cyl(0.74, 0.22, 7, 30, '#c98a4a'); k.cyl(0.74, 0.46, 7, 30, '#c98a4a'); k.cyl(0.74, 0.7, 7, 30, '#b87a3e');   // copper vats
  k.line(k.P(0.74, 0.22, 30), k.P(0.58, 0.3, 30), k.C('#888'), 1.2);
  for (let i = 0; i < 6; i++) k.cyl(0.14 + (i % 3) * 0.08, 0.8 + (i >> 1 & 1) * 0.08, 2.6, 5, '#8a5a34');       // barrels
}
function pondBottling(k, v) {
  const { P, C, sh, line } = k;
  k.pad('#b8b6a8', ['#8a8574', '#bdb8a6']);
  sh(0.08, 0.3, 0.56, 0.6, 46);
  k.box(0.08, 0.3, 0.56, 0.6, 40, k.faces('#eef1f3'));
  for (let z = 10; z < 40; z += 10) line(P(0.08, 0.9, z), P(0.64, 0.9, z), C('#4a90c4'), 1.4);
  k.wins(0.08, 0.3, 0.56, 0.6, 40, v + 65, { dens: 2.6, rh: 14, wh: 6, base: 14 });
  k.cyl(0.78, 0.2, 9, 62, '#cfe6f3'); k.cyl(0.78, 0.5, 9, 62, '#cfe6f3');            // spring-water tanks
  k.circ(P(0.78, 0.2, 62), 2, C('#4a90c4')); k.circ(P(0.78, 0.5, 62), 2, C('#4a90c4'));
  k.box(0.64, 0.75, 0.3, 0.06, 4, k.faces('#9aa0a8'), 12);                         // conveyor
  for (let i = 0; i < 5; i++) k.box(0.66 + i * 0.055, 0.76, 0.03, 0.03, 4, k.faces('#7fc4ea'), 16);
  k.box(0.1, 0.08, 0.2, 0.18, 8, k.faces('#dfe7ea'));
}
function pondGreenhouses(k, v) {
  const { P, C, sh, line } = k;
  k.pad('#9fd283', ['#4d8f3c', '#8fd070', '#3f7f34']);
  for (const [x, y] of [[0.08, 0.08], [0.08, 0.42]]) {
    k.box(x, y, 0.56, 0.28, 12, { l: '#d6eef4', r: '#bfdeea', t: '#e9f6f9' });
    k.poly([P(x, y + 0.28, 0), P(x + 0.56, y + 0.28, 0), P(x + 0.56, y + 0.28, 12), P(x, y + 0.28, 12)], 'rgba(0,0,0,0)', 'glass', true);
    const ym = y + 0.14;
    k.poly([P(x, y + 0.28, 12), P(x + 0.56, y + 0.28, 12), P(x + 0.56, ym, 20), P(x, ym, 20)], C('#dff2f7'), 'glass');
    k.poly([P(x + 0.56, y, 12), P(x + 0.56, y + 0.28, 12), P(x + 0.56, ym, 20)], C('#c4e2ec'));
    for (let i = 1; i < 8; i++) line(P(x + 0.07 * i, y + 0.28, 0), P(x + 0.07 * i, ym, 20), 'rgba(255,255,255,.7)', 0.5);
    for (let i = 0; i < 7; i++) k.circ(P(x + 0.05 + i * 0.075, y + 0.2, 4), 2, C('#4f9e40'));
  }
  sh(0.7, 0.14, 0.24, 0.5, 30);
  k.box(0.7, 0.14, 0.24, 0.5, 30, k.faces('#eef0ec'));
  k.wins(0.7, 0.14, 0.24, 0.5, 30, v + 75, { dens: 3, rh: 9, wh: 6, base: 5, glass: 1 });
  k.box(0.72, 0.16, 0.2, 0.46, 3, k.faces('#7fb069'), 30);
  k.tree(0.2, 0.88, 3, v + 1); k.tree(0.86, 0.86, 0, v + 2);
}

// ================= LAKE: timber lake country =================
function logs(k, x, y, w, d, h) { for (let z = 3; z < h; z += 3) { k.line(k.P(x, y + d, z), k.P(x + w, y + d, z), 'rgba(50,30,10,.28)', 0.6); k.line(k.P(x + w, y, z), k.P(x + w, y + d, z), 'rgba(40,20,5,.28)', 0.6); } }
function lakeCabin(k, v) {
  const { P, C, sh, win } = k;
  k.pad('#8fbf78', ['#3f7f34', '#6aa04f', '#a58a5a']);
  k.tree(0.1, 0.12, 1, v + 1); k.tree(0.86, 0.12, 1, v + 2);
  const x = 0.18, y = 0.16, w = 0.5, d = 0.42;
  sh(x, y, w, d, 32);
  gable(k, x, y, w, d, 16, 18, TIMBER[v % 4], LROOF[v % 4]);
  logs(k, x, y, w, d, 16);
  k.box(x + 0.06, y + 0.06, 0.08, 0.08, 30, k.faces('#8f8a82'), 4);                // stone chimney
  win([P(x + 0.08, y + d, 5), P(x + 0.2, y + d, 5), P(x + 0.2, y + d, 12), P(x + 0.08, y + d, 12)], hash(v, 3, 3), 0);
  win([P(x + w, y + 0.1, 5), P(x + w, y + 0.22, 5), P(x + w, y + 0.22, 12), P(x + w, y + 0.1, 12)], hash(v, 4, 3), 1);
  posts(k, x, y + d, w, 0.24, 4); deck(k, x, y + d, w, 0.24, 4); rail(k, x, y + d, w, 0.24, 5.6, '#7a5436');   // porch deck
  k.box(x + 0.1, y + d + 0.08, 0.06, 0.06, 4, k.faces('#d24a3a'), 5.6); k.box(x + 0.3, y + d + 0.08, 0.06, 0.06, 4, k.faces('#2e86c1'), 5.6);   // deck chairs
  boat(k, 0.7, 0.78, 0.18, 0.06, ['#c0392b', '#2e86c1', '#e67e22', '#27ae60'][v % 4], { h: 2.4, deck: '#7a5436' });   // a canoe on the grass
}
function lakeChalets(k, v) {
  const { sh } = k;
  k.pad('#8fbf78', ['#3f7f34', '#6aa04f']);
  const x = 0.14, y = 0.14, w = 0.64, d = 0.5;
  sh(x, y, w, d, 56);
  gable(k, x, y, w, d, 30, 26, TIMBER[(v + 1) % 4], LROOF[(v + 1) % 4]);
  logs(k, x, y, w, 0.5, 13);
  k.wins(x, y, w, d, 30, v + 14, { dens: 3, rh: 13, wh: 7, base: 4 });
  posts(k, x, y, w + 0.06, d + 0.06, 14); deck(k, x, y, w + 0.08, d + 0.08, 13);      // wraparound balcony
  rail(k, x, y, w + 0.08, d + 0.08, 14.6, '#5a3d26');
  k.tree(0.9, 0.2, 1, v + 2); k.tree(0.14, 0.88, 1, v + 3); k.tree(0.88, 0.86, 3, v + 4);
}
function lakeApartments(k, v) {
  const { P, C, sh, line, box } = k;
  const x = 0.13, y = 0.13, w = 0.74, d = 0.7, h = 66;
  k.pad('#9cc784', ['#3f7f34', '#6aa04f']);
  sh(x, y, w, d, h);
  box(x, y, w, d, 10, k.faces('#9a948a'));                                          // stone base
  box(x, y, w, d, h - 10, k.faces(['#b98a5e', '#a87a52', '#c49a6c', '#9c6e48'][v % 4]), 10);
  for (let i = 0; i < 24; i++) { const u = x + (w * i) / 24; line(P(u, y + d, 10), P(u, y + d, h), 'rgba(60,35,15,.22)', 0.5); }   // timber slats
  k.wins(x, y, w, d, h, v + 24, { dens: 2.8, rh: 13, wh: 7, base: 14 });
  balconies(k, x, y, w, d, 22, h, 13, '#e9e4da', true);
  k.poly([P(x + 0.1, y + d, 1), P(x + 0.4, y + d, 1), P(x + 0.4, y + d, 9), P(x + 0.1, y + d, 9)], k.store());
  box(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 2, k.faces('#7fb069'), h);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.poly([P(x + 0.12 + i * 0.18, y + 0.14 + j * 0.24, h + 3), P(x + 0.26 + i * 0.18, y + 0.14 + j * 0.24, h + 3), P(x + 0.26 + i * 0.18, y + 0.32 + j * 0.24, h + 7), P(x + 0.12 + i * 0.18, y + 0.32 + j * 0.24, h + 7)], C('#2c4a7a'));
  k.tree(0.07, 0.9, 1, v + 9);
}
function lakeTower(k, v) {
  const { P, C, sh, line, box } = k;
  const x = 0.18, y = 0.18, w = 0.64, d = 0.64, h = 146, gl = ['#7ab3cf', '#6fa6c4', '#80b8c2', '#8aa8c6'][v % 4];
  k.pad('#9cc784', ['#3f7f34', '#6aa04f']);
  sh(x, y, w, d, h + 20);
  box(x - 0.04, y - 0.04, w + 0.08, d + 0.08, 14, k.faces('#9a948a'));
  box(x, y, w, d, h, k.faces(gl), 14);
  k.poly([P(x, y + d, 14), P(x + w, y + d, 14), P(x + w, y + d, h + 14), P(x, y + d, h + 14)], 'rgba(0,0,0,0)', 'glass', true);
  k.wins(x, y, w, d, h + 14, v + 34, { dens: 4, rh: 9, wh: 5, base: 20, glass: 1 });
  for (let i = 0; i <= 4; i++) { line(P(x + (w * i) / 4, y + d + 0.02, 14), P(x + (w * i) / 4, y + d + 0.02, h + 14), C('#8a5a34'), 2.2); line(P(x + w + 0.02, y + (d * i) / 4, 14), P(x + w + 0.02, y + (d * i) / 4, h + 14), C('#6b4426'), 2.2); }   // timber fins
  for (let z = 34; z < h; z += 30) { line(P(x, y + d + 0.02, z), P(x + w, y + d + 0.02, z), C('#8a5a34'), 1.4); line(P(x + w + 0.02, y, z), P(x + w + 0.02, y + d, z), C('#6b4426'), 1.4); }
  k.poly([P(x + 0.06, y + d + 0.04, 1), P(x + w - 0.06, y + d + 0.04, 1), P(x + w - 0.06, y + d + 0.04, 11), P(x + 0.06, y + d + 0.04, 11)], k.store());
  deck(k, x, y, w, d, h + 14, '#a8774a');                                           // roof terrace
  for (let i = 0; i < 3; i++) { const a = P(x + 0.1 + i * 0.2, y + 0.1, h + 16); line(a, [a[0], a[1] - 10], C('#6b4426'), 1); }
  line(P(x + 0.1, y + 0.1, h + 26), P(x + 0.5, y + 0.1, h + 26), C('#6b4426'), 1.2);
  k.tree(x + 0.48, y + 0.42, 1, v + 3);
  k.tree(0.08, 0.9, 1, v + 1);
}
function lakeBoathouse(k, v) {
  const { P, C, sh } = k;
  k.pad('#8fbf78', ['#3f7f34', '#6aa04f']);
  basin(k, 0.06, 0.7, 0.9, 0.26);                                                  // a slip of water for the boats
  sh(0.14, 0.12, 0.5, 0.54, 36);
  gable(k, 0.14, 0.12, 0.5, 0.54, 18, 18, ['#a8423a', '#3f6f8f', '#4c7a5a', '#8d6a3c'][v % 4], '#4a4a4f');
  for (let i = 0; i < 10; i++) k.line(P(0.14 + i * 0.05, 0.66, 0), P(0.14 + i * 0.05, 0.66, 18), 'rgba(0,0,0,.18)', 0.5);
  k.poly([P(0.24, 0.66, 0), P(0.5, 0.66, 0), P(0.5, 0.66, 13), P(0.24, 0.66, 13)], C('#2a2a2e'));            // the big boat doors
  k.poly([P(0.64, 0.24, 4), P(0.64, 0.5, 4), P(0.64, 0.5, 12), P(0.64, 0.24, 12)], k.store());
  deck(k, 0.64, 0.12, 0.3, 0.56, 2);
  umbrella(k, 0.76, 0.24, '#f4efe6', 3.6); umbrella(k, 0.82, 0.52, '#f4efe6', 3.6); table(k, 0.76, 0.24, 3.6); table(k, 0.82, 0.52, 3.6);
  lights(k, P(0.64, 0.12, 22), P(0.94, 0.68, 14), 3);
  boat(k, 0.22, 0.78, 0.22, 0.08, '#f4efe6', { h: 3, deck: '#a8774a' }); boat(k, 0.56, 0.82, 0.18, 0.06, '#c0392b', { h: 2.4, deck: '#7a5436' });
}
function lakeRestaurant(k, v) {
  const { P, C, sh } = k;
  k.pad('#8fbf78', ['#3f7f34', '#6aa04f']);
  sh(0.08, 0.1, 0.84, 0.38, 30);
  gable(k, 0.08, 0.1, 0.84, 0.38, 18, 12, TIMBER[(v + 2) % 4], LROOF[(v + 2) % 4]);
  k.poly([P(0.12, 0.48, 2), P(0.88, 0.48, 2), P(0.88, 0.48, 15), P(0.12, 0.48, 15)], k.store());          // a wall of windows
  for (let i = 1; i < 8; i++) k.line(P(0.12 + i * 0.095, 0.48, 2), P(0.12 + i * 0.095, 0.48, 15), C('#5a3d26'), 0.8);
  deck(k, 0.08, 0.5, 0.84, 0.42, 1);
  for (const [a, b] of [[0.08, 0.92], [0.5, 0.92], [0.92, 0.92]]) k.line(P(a, b, 2.6), P(a, b, 18), C('#5a3d26'), 1);
  lights(k, P(0.08, 0.92, 18), P(0.5, 0.92, 18), 3); lights(k, P(0.5, 0.92, 18), P(0.92, 0.92, 18), 3);
  for (let i = 0; i < 4; i++) table(k, 0.18 + i * 0.2, 0.68, 2.6);
  k.tree(0.94, 0.08, 1, v + 1);
}
function lakeLodge(k, v) {
  const { P, sh } = k;
  const x = 0.1, y = 0.12, w = 0.8, d = 0.46;
  k.pad('#9cc784', ['#3f7f34', '#6aa04f']);
  sh(x, y, w, d + 0.2, 70);
  k.box(x, y, w, d, 10, k.faces('#8f8a82'));
  gable(k, x, y, w, d, 36, 22, TIMBER[v % 4], LROOF[v % 4], 10);
  k.wins(x, y, w, d, 46, v + 44, { dens: 3, rh: 12, wh: 7, base: 14 });
  gable(k, 0.34, 0.5, 0.3, 0.2, 30, 16, TIMBER[(v + 1) % 4], LROOF[v % 4]);           // the entrance wing
  k.poly([P(0.42, 0.7, 0), P(0.56, 0.7, 0), P(0.56, 0.7, 12), P(0.42, 0.7, 12)], k.store());
  k.box(x + w - 0.16, y + 0.06, 0.1, 0.1, 28, k.faces('#8f8a82'), 46);                // big stone chimney
  for (let i = 0; i < 3; i++) { const p = P(0.14 + i * 0.07, 0.86, 0); k.line(p, [p[0], p[1] - 22], k.C('#c9d3de'), 0.7); k.poly([[p[0], p[1] - 22], [p[0] + 7, p[1] - 20], [p[0], p[1] - 18]], k.C(['#2f6a44', '#a8423a', '#2e5e8c'][i])); }
  k.tree(0.84, 0.86, 1, v + 2);
}
function lakeSpa(k, v) {
  const { P, C, sh, box, line } = k;
  const x = 0.2, y = 0.16, w = 0.6, d = 0.56, h = 140;
  k.pad('#9cc784', ['#3f7f34', '#6aa04f']);
  sh(x - 0.08, y - 0.04, w + 0.16, d + 0.2, h + 30);
  box(0.08, 0.1, 0.84, 0.8, 16, k.faces('#9a948a'));                                // stone podium
  pool(k, 0.12, 0.66, 0.2, 0.18, 16); lounger(k, 0.38, 0.72, 16, '#f4efe6'); lounger(k, 0.38, 0.8, 16, '#f4efe6');   // outdoor hot pool
  box(x, y, w, d, h, k.faces(['#c49a6c', '#b98a5e', '#a87a52', '#d0a878'][v % 4]), 16);
  for (let i = 0; i < 18; i++) line(P(x + (w * i) / 18, y + d, 16), P(x + (w * i) / 18, y + d, h + 16), 'rgba(60,35,15,.2)', 0.5);
  k.wins(x, y, w, d, h + 16, v + 54, { dens: 3, rh: 11, wh: 6, base: 24 });
  balconies(k, x, y, w, d, 30, h + 10, 22, '#e9e4da', true);
  box(x + 0.06, y + 0.06, w - 0.12, d - 0.12, 20, { l: '#bfe3f0', r: '#a6d0e2', t: '#e4f3f8' }, h + 16);   // the glass sky lounge
  k.poly([P(x + 0.06, y + d - 0.06, h + 16), P(x + w - 0.06, y + d - 0.06, h + 16), P(x + w - 0.06, y + d - 0.06, h + 36), P(x + 0.06, y + d - 0.06, h + 36)], 'rgba(0,0,0,0)', 'glass', true);
  box(x + 0.02, y + 0.02, w - 0.04, d - 0.04, 3, k.faces('#5a4636'), h + 36);
  crown(k, x + 0.3, y + 0.3, h + 39, 12);
  k.tree(0.9, 0.92, 1, v + 1);
}
function lakeBoatyard(k, v) {
  const { P, C, sh, line } = k;
  k.pad('#a9a493', ['#8a8574', '#bdb8a6']);
  basin(k, 0.06, 0.72, 0.9, 0.24);
  k.poly([P(0.36, 0.5), P(0.6, 0.5), P(0.6, 0.72), P(0.36, 0.72)], C('#9a8a70'), null, true);        // slipway
  sh(0.08, 0.08, 0.5, 0.4, 34);
  gable(k, 0.08, 0.08, 0.5, 0.4, 20, 14, ['#c9ccd2', '#b8c2cc', '#c7c2b2', '#d3d7de'][v % 4], '#5e6570');
  k.poly([P(0.16, 0.48, 0), P(0.48, 0.48, 0), P(0.48, 0.48, 16), P(0.16, 0.48, 16)], C('#2f3238'));
  for (const u of [0.4, 0.5]) line(P(u, 0.56, 0), P(u, 0.56, 5), C('#5a3d26'), 1.2);                 // a boat on its cradle
  boat(k, 0.34, 0.52, 0.22, 0.09, ['#2e86c1', '#f4efe6', '#c0392b', '#27ae60'][v % 4], { h: 5, deck: '#a8774a', cabin: 4 });
  for (let i = 0; i < 4; i++) k.box(0.68, 0.14 + i * 0.03, 0.26, 0.025, 2, k.faces('#c49a6c'), i * 2);   // stacked timber
  k.tree(0.9, 0.5, 1, v + 1);
}
function lakeWharf(k, v) {
  const { P, C, sh, circ } = k;
  k.pad('#a9a493', ['#8a8574', '#bdb8a6']);
  basin(k, 0.04, 0.68, 0.92, 0.28);
  sh(0.08, 0.08, 0.6, 0.42, 30);
  k.box(0.08, 0.08, 0.6, 0.42, 24, k.faces(['#b8856a', '#a87a62', '#9c7160', '#b58f72'][v % 4]));
  k.wins(0.08, 0.08, 0.6, 0.42, 24, v + 64, { dens: 2, rh: 10, wh: 5, base: 14 });
  for (let i = 0; i < 2; i++) k.poly([P(0.14 + i * 0.26, 0.5, 0), P(0.32 + i * 0.26, 0.5, 0), P(0.32 + i * 0.26, 0.5, 12), P(0.14 + i * 0.26, 0.5, 12)], C('#4a5568'));
  for (let i = 0; i < 4; i++) circ(P(0.12 + i * 0.25, 0.67, 2), 1.6, C('#333'));                 // bollards
  boat(k, 0.1, 0.76, 0.62, 0.14, '#3a4a5a', { h: 4, deck: '#5a5a5a' });                         // a barge carrying gravel
  k.ell(P(0.36, 0.83, 7), 18, 5, C('#c9b28a'));
  k.box(0.6, 0.77, 0.1, 0.12, 8, k.faces('#f4efe6'), 4);
  for (let i = 0; i < 6; i++) crate(k, 0.74 + (i % 2) * 0.08, 0.14 + (i >> 1) * 0.1, 0, '#d9c79a');
}
function lakeFreight(k, v) {
  const { P, C, sh } = k;
  k.pad('#a9a493', ['#8a8574', '#bdb8a6']);
  basin(k, 0.04, 0.66, 0.92, 0.3);
  sh(0.06, 0.06, 0.62, 0.44, 34);
  k.box(0.06, 0.06, 0.62, 0.44, 30, { l: '#c9ccd2', r: shade('#c9ccd2', 0.76), t: '#8f98a6' });
  for (let i = 1; i < 10; i++) k.line(P(0.06 + i * 0.062, 0.06, 30), P(0.06 + i * 0.062, 0.5, 30), 'rgba(0,0,0,.2)', 0.6);
  for (let i = 0; i < 3; i++) k.poly([P(0.1 + i * 0.2, 0.5, 0), P(0.24 + i * 0.2, 0.5, 0), P(0.24 + i * 0.2, 0.5, 13), P(0.1 + i * 0.2, 0.5, 13)], C('#4a5568'));
  boat(k, 0.08, 0.74, 0.6, 0.14, '#2f4a5e', { h: 4, deck: '#5a5a5a' });
  container(k, 0.14, 0.76, 4, '#d9534a'); container(k, 0.38, 0.76, 4, '#4a7fc7'); container(k, 0.26, 0.76, 11, '#d9a441');
  jibCrane(k, 0.8, 0.56, 54, ['#e0a030', '#d9534a', '#3a7fc7', '#e0a030'][v % 4], -0.2, 0.24);
}
function lakeBoatWorks(k, v) {
  const { P, C, sh, line } = k;
  k.pad('#9fd283', ['#4d8f3c', '#8fd070', '#3f7f34']);
  basin(k, 0.04, 0.7, 0.92, 0.26);
  sh(0.08, 0.08, 0.6, 0.48, 36);
  k.box(0.08, 0.08, 0.6, 0.48, 30, k.faces('#e9edf1'));
  k.poly([P(0.08, 0.56, 3), P(0.68, 0.56, 3), P(0.68, 0.56, 27), P(0.08, 0.56, 27)], C(['#6db6de', '#68bfc0', '#7aa7d6', '#8aa4c8'][v % 4]), 'glass');
  for (let i = 1; i < 8; i++) line(P(0.08 + i * 0.075, 0.56, 3), P(0.08 + i * 0.075, 0.56, 27), C('#a8774a'), 1.2);
  for (let i = 0; i < 4; i++) k.poly([P(0.12 + i * 0.14, 0.12, 31), P(0.24 + i * 0.14, 0.12, 31), P(0.24 + i * 0.14, 0.5, 36), P(0.12 + i * 0.14, 0.5, 36)], C('#2c4a7a'));   // solar roof
  boat(k, 0.12, 0.78, 0.26, 0.09, '#f4f4f0', { h: 3.5, deck: '#a8774a', cabin: 4, cabinCol: '#bfe3f0' });     // electric launches
  boat(k, 0.52, 0.8, 0.26, 0.09, '#2e86c1', { h: 3.5, deck: '#a8774a', cabin: 4, cabinCol: '#bfe3f0' });
  k.tree(0.84, 0.16, 1, v + 1); k.tree(0.86, 0.46, 3, v + 2);
}

// ================= SEA: the seaside =================
const SAND = ['#ecd9a6', '#e6d29c', '#efdcad', '#e9d4a0'];
function seaCottage(k, v) {
  const { P, C, sh, win, line } = k;
  k.pad(SAND[v % 4], ['#d6c08a', '#f4e4b8', '#c9b07a']);
  const x = 0.2, y = 0.14, w = 0.52, d = 0.46, z0 = 9;
  sh(x, y, w, d + 0.2, 34);
  posts(k, x, y, w, d + 0.2, z0);
  deck(k, x - 0.02, y, w + 0.04, d + 0.22, z0 - 1.6);
  gable(k, x, y, w, d, 16, 13, PASTEL[v % 4], ['#f4f4f0', '#4f86a8', '#e8e2d6', '#c4553a'][v % 4], z0);
  win([P(x + 0.08, y + d, z0 + 4), P(x + 0.2, y + d, z0 + 4), P(x + 0.2, y + d, z0 + 11), P(x + 0.08, y + d, z0 + 11)], hash(v, 5, 5), 0);
  win([P(x + w, y + 0.12, z0 + 4), P(x + w, y + 0.26, z0 + 4), P(x + w, y + 0.26, z0 + 11), P(x + w, y + 0.12, z0 + 11)], hash(v, 6, 5), 1);
  k.poly([P(x + 0.3, y + d, z0), P(x + 0.4, y + d, z0), P(x + 0.4, y + d, z0 + 12), P(x + 0.3, y + d, z0 + 12)], C('#f4f4f0'));
  rail(k, x - 0.02, y + d, w + 0.04, 0.22, z0, '#f4f4f0');
  for (let i = 0; i < 4; i++) line(P(0.46 + i * 0.03, 0.86, (3 - i) * 2.6), P(0.49 + i * 0.03, 0.86, (3 - i) * 2.6), C('#a8774a'), 1.6);   // steps down to the sand
  palm(k, 0.86, 0.2, v); palm(k, 0.12, 0.86, v + 2);
  k.box(0.82, 0.74, 0.03, 0.1, 18, k.faces(['#e67e22', '#2e86c1', '#e86f9b', '#27ae60'][v % 4]));              // a surfboard leaning on the post
  lounger(k, 0.6, 0.9, 0, '#f4efe6');
}
function seaHolidayFlats(k, v) {
  const { P, C, sh, box } = k;
  const x = 0.14, y = 0.14, w = 0.72, d = 0.66, h = 52;
  k.pad(SAND[v % 4], ['#d6c08a', '#f4e4b8']);
  sh(x, y, w, d, h);
  box(x, y, w, d, h, k.faces('#f6f4ee'));
  k.wins(x, y, w, d, h, v + 13, { dens: 3, rh: 12, wh: 7, base: 13 });
  balconies(k, x, y, w, d, 12, h, 12, '#ffffff', false);
  for (let z = 12; z < h; z += 12) for (let i = 0; i < 4; i++) k.poly([P(x + 0.04 + i * 0.18, y + d + 0.06, z + 9), P(x + 0.16 + i * 0.18, y + d + 0.06, z + 9), P(x + 0.16 + i * 0.18, y + d + 0.1, z + 6), P(x + 0.04 + i * 0.18, y + d + 0.1, z + 6)], C(['#2e86c1', '#e67e22', '#27ae60', '#e04848'][(i + v + z / 12) % 4]));   // colourful sunshades
  box(x + 0.1, y + 0.1, 0.2, 0.16, 6, k.faces('#d7dde4'), h);
  palm(k, 0.08, 0.9, v); palm(k, 0.92, 0.9, v + 3);
}
function seaCondos(k, v) {
  const { P, C, sh, box } = k;
  const x = 0.16, y = 0.12, w = 0.7, d = 0.6, h = 92;
  k.pad(SAND[v % 4], ['#d6c08a', '#f4e4b8']);
  sh(x, y, w, d, h);
  box(x, y, w, d, h, k.faces(['#f4f6f6', '#eef2f4', '#f6f2ec', '#eaf1f1'][v % 4]));
  k.wins(x, y, w, d, h, v + 23, { dens: 3.6, rh: 11, wh: 7, base: 12, glass: 1 });
  balconies(k, x, y, w, d, 11, h, 11, '#ffffff', true);
  box(x + 0.04, y + 0.04, w - 0.08, d - 0.08, 6, k.faces(['#4f9fc4', '#2f86b8', '#5fb5b8', '#4f86a8'][v % 4]), h);
  pool(k, 0.06, 0.78, 0.26, 0.14, 0.5); umbrella(k, 0.42, 0.86, '#f4efe6'); lounger(k, 0.5, 0.8, 0, '#f4efe6');
  palm(k, 0.92, 0.9, v); palm(k, 0.92, 0.1, v + 1);
}
function seaLuxuryTower(k, v) {
  const { P, C, sh, box } = k;
  const x = 0.18, y = 0.18, w = 0.64, d = 0.64, h = 168;
  k.pad(SAND[v % 4], ['#d6c08a', '#f4e4b8']);
  sh(x, y, w, d, h + 20);
  box(x - 0.06, y - 0.06, w + 0.12, d + 0.12, 12, k.faces('#e8e2d6'));
  box(x, y, w, d, h, k.faces(['#f4f6f6', '#eef0f2', '#f6f1ea', '#eaf0f2'][v % 4]), 12);
  k.wins(x, y, w, d, h + 12, v + 33, { dens: 4, rh: 10, wh: 6.5, base: 20, glass: 1 });
  balconies(k, x, y, w, d, 22, h + 8, 10, '#ffffff', true);
  pool(k, x + 0.06, y + 0.06, w - 0.22, d - 0.3, h + 12);                             // the rooftop pool
  lounger(k, x + 0.08, y + d - 0.18, h + 12, '#f4efe6'); lounger(k, x + 0.3, y + d - 0.18, h + 12, '#f4efe6');
  umbrella(k, x + w - 0.1, y + d - 0.1, '#f4efe6', h + 12, 5);
  palm(k, 0.08, 0.9, v); palm(k, 0.92, 0.92, v + 2);
}
function seaShack(k, v) {
  const { P, C, sh, box } = k;
  k.pad(SAND[v % 4], ['#d6c08a', '#f4e4b8']);
  deck(k, 0.08, 0.5, 0.84, 0.42, 0);
  if (v % 2) {                                                                       // ice-cream kiosk
    sh(0.2, 0.14, 0.4, 0.34, 24);
    box(0.2, 0.14, 0.4, 0.34, 16, k.faces('#f7c6d9'));
    k.poly([P(0.24, 0.48, 6), P(0.56, 0.48, 6), P(0.56, 0.48, 13), P(0.24, 0.48, 13)], k.store());
    for (let i = 0; i < 5; i++) k.poly([P(0.2 + i * 0.08, 0.48, 18), P(0.28 + i * 0.08, 0.48, 18), P(0.28 + i * 0.08, 0.58, 14), P(0.2 + i * 0.08, 0.58, 14)], C(i % 2 ? '#ffffff' : '#e86f9b'));
    const c = P(0.4, 0.31, 16); k.ell([c[0], c[1] - 10], 5, 5, C('#fff1c9')); k.poly([[c[0] - 4, c[1] - 8], [c[0] + 4, c[1] - 8], [c[0], c[1] + 2]], C('#d9a05a'));   // giant cone on the roof
  } else {                                                                           // seafood shack
    sh(0.16, 0.14, 0.48, 0.36, 26);
    gable(k, 0.16, 0.14, 0.48, 0.36, 14, 9, ['#4f86a8', '#3f6f8f', '#5a9ab8', '#2e6e8e'][v % 4], '#f4f4f0');
    k.poly([P(0.22, 0.5, 4), P(0.56, 0.5, 4), P(0.56, 0.5, 11), P(0.22, 0.5, 11)], k.store());
    const s = P(0.4, 0.5, 23); k.ell(s, 7, 3, C('#e67e22')); k.poly([[s[0] + 6, s[1]], [s[0] + 10, s[1] - 3], [s[0] + 10, s[1] + 3]], C('#e67e22'));   // fish sign
    k.box(0.12, 0.1, 0.03, 0.22, 2, k.faces('#6b4a2f')); k.line(P(0.135, 0.1, 2), P(0.135, 0.32, 8), C('#c8b88a'), 0.5);   // drying nets
  }
  umbrella(k, 0.3, 0.74, ['#e04848', '#2e86c1'][v % 2], 1.6); umbrella(k, 0.62, 0.8, '#f4c542', 1.6); umbrella(k, 0.82, 0.6, '#27ae60', 1.6);
  table(k, 0.3, 0.74, 1.6); table(k, 0.62, 0.8, 1.6); table(k, 0.82, 0.6, 1.6);
  palm(k, 0.86, 0.14, v);
}
function seaBoardwalk(k, v) {
  const { P, C, sh } = k;
  k.pad(SAND[v % 4], ['#d6c08a', '#f4e4b8']);
  deck(k, 0.04, 0.6, 0.92, 0.36, 0);
  for (const [x, col] of [[0.08, PASTEL[v % 4]], [0.5, PASTEL[(v + 2) % 4]]]) {
    sh(x, 0.12, 0.38, 0.44, 30);
    k.box(x, 0.12, 0.38, 0.44, 22, k.faces(col));
    k.wins(x, 0.12, 0.38, 0.44, 22, v + x * 10, { dens: 3, rh: 10, wh: 5, base: 14 });
    k.poly([P(x + 0.04, 0.56, 1), P(x + 0.34, 0.56, 1), P(x + 0.34, 0.56, 11), P(x + 0.04, 0.56, 11)], k.store());
    for (let i = 0; i < 4; i++) k.poly([P(x + 0.02 + i * 0.085, 0.56, 14), P(x + 0.105 + i * 0.085, 0.56, 14), P(x + 0.105 + i * 0.085, 0.68, 10), P(x + 0.02 + i * 0.085, 0.68, 10)], C(i % 2 ? '#ffffff' : ['#2e86c1', '#e04848', '#27ae60', '#e67e22'][(v + (x > 0.3 ? 1 : 0)) % 4]));
    k.box(x + 0.02, 0.14, 0.34, 0.4, 2, k.faces('#e8e2d6'), 22);
  }
  for (let i = 0; i < 4; i++) { umbrella(k, 0.14 + i * 0.22, 0.84, ['#e04848', '#2e86c1', '#f4c542', '#27ae60'][(i + v) % 4], 1.6); table(k, 0.14 + i * 0.22, 0.84, 1.6); }
}
function seaHotel(k, v) {
  const { P, C, sh, box } = k;
  const x = 0.1, y = 0.1, w = 0.8, d = 0.46, h = 76, acc = ['#e67e5c', '#2e86c1', '#2fa89a', '#e0a030'][v % 4];
  k.pad(SAND[v % 4], ['#d6c08a', '#f4e4b8']);
  sh(x, y, w, d, h);
  box(x, y, w, d, h, k.faces('#f8f6f0'));
  k.wins(x, y, w, d, h, v + 43, { dens: 3.4, rh: 11, wh: 7, base: 14 });
  balconies(k, x, y, w, d, 12, h, 11, '#ffffff', false);
  k.poly([P(x + w * 0.44, y + d, 0), P(x + w * 0.56, y + d, 0), P(x + w * 0.56, y + d, h), P(x + w * 0.44, y + d, h)], C(acc));
  k.poly([P(x + 0.1, y + d, 1), P(x + w * 0.42, y + d, 1), P(x + w * 0.42, y + d, 10), P(x + 0.1, y + d, 10)], k.store());
  box(x + 0.1, y + 0.1, 0.3, 0.2, 8, k.faces(acc), h);
  pool(k, 0.12, 0.66, 0.4, 0.22, 0.5);
  umbrella(k, 0.62, 0.7, acc); umbrella(k, 0.78, 0.84, acc); lounger(k, 0.6, 0.86, 0, '#f4efe6'); lounger(k, 0.74, 0.66, 0, '#f4efe6');
  palm(k, 0.92, 0.6, v); palm(k, 0.06, 0.94, v + 2);
}
function seaResortTower(k, v) {
  const { P, C, sh, box } = k;
  const acc = ['#2fa89a', '#e67e5c', '#2e86c1', '#e0a030'][v % 4];
  k.pad(SAND[v % 4], ['#d6c08a', '#f4e4b8']);
  sh(0.08, 0.08, 0.84, 0.84, 190);
  box(0.06, 0.06, 0.88, 0.88, 14, k.faces('#efe9dc'));                              // podium with lobby
  pool(k, 0.1, 0.62, 0.3, 0.26, 14); umbrella(k, 0.5, 0.82, acc, 14, 5); lounger(k, 0.6, 0.86, 14, '#f4efe6');
  const tiers = [[0.14, 0.14, 0.6, 0.44, 80], [0.18, 0.18, 0.52, 0.36, 56], [0.24, 0.22, 0.4, 0.28, 34]];
  let z = 14;
  for (const [x, y, w, d, h] of tiers) {
    box(x, y, w, d, h, k.faces('#fbfaf6'), z);
    k.wins(x, y, w, d, h + z, v + 53 + z, { dens: 3.6, rh: 10, wh: 6.5, base: z + 6, glass: 1 });
    balconies(k, x, y, w, d, z + 6, z + h, 10, '#ffffff', true);
    z += h;
    box(x + 0.02, y + 0.02, w - 0.04, d - 0.04, 2, k.faces(acc), z);
    if (z < 160) { k.circ(P(x + w - 0.06, y + d - 0.06, z + 6), 4, C('#3f8f3a')); k.circ(P(x + 0.06, y + d - 0.06, z + 6), 3.4, C('#4f9e40')); }
    z += 2;
  }
  crown(k, 0.44, 0.36, z, 18);
  palm(k, 0.9, 0.9, v); palm(k, 0.9, 0.1, v + 2); palm(k, 0.08, 0.92, v + 4);
}
function seaFishingWharf(k, v) {
  const { P, C, sh, line } = k;
  k.pad('#b8b09a', ['#8a8574', '#bdb8a6']);
  basin(k, 0.04, 0.6, 0.92, 0.36);
  posts(k, 0.36, 0.6, 0.12, 0.36, 3); deck(k, 0.36, 0.6, 0.12, 0.36, 2);                // a wooden pier into the basin
  sh(0.08, 0.1, 0.46, 0.36, 28);
  gable(k, 0.08, 0.1, 0.46, 0.36, 16, 11, ['#a8423a', '#3f6f8f', '#d9c79a', '#4c7a5a'][v % 4], '#5e6570');
  for (let i = 0; i < 9; i++) line(P(0.08 + i * 0.05, 0.46, 0), P(0.08 + i * 0.05, 0.46, 16), 'rgba(0,0,0,.18)', 0.5);
  k.poly([P(0.18, 0.46, 0), P(0.4, 0.46, 0), P(0.4, 0.46, 12), P(0.18, 0.46, 12)], C('#3a3a3e'));
  boat(k, 0.08, 0.66, 0.22, 0.1, ['#e67e22', '#2e86c1', '#c0392b', '#27ae60'][v % 4], { h: 4.5, cabin: 6, mast: 22 });
  boat(k, 0.54, 0.76, 0.24, 0.1, ['#2e86c1', '#e67e22', '#f4c542', '#c0392b'][v % 4], { h: 4.5, cabin: 6, mast: 20 });
  for (let i = 0; i < 6; i++) crate(k, 0.62 + (i % 3) * 0.09, 0.16 + (i >> 1 & 1) * 0.1, 0, '#4f86a8');           // fish crates
  k.box(0.62, 0.36, 0.3, 0.04, 2, k.faces('#6b4a2f')); line(P(0.62, 0.38, 2), P(0.92, 0.38, 2), C('#c8b88a'), 2.5);   // nets drying
}
function seaCargoDock(k, v) {
  const { P, C, sh, circ } = k;
  k.pad('#b8b6aa', ['#8a8574', '#bdb8a6']);
  basin(k, 0.04, 0.62, 0.92, 0.34);
  sh(0.06, 0.06, 0.5, 0.42, 32);
  k.box(0.06, 0.06, 0.5, 0.42, 28, { l: '#d3d7de', r: shade('#d3d7de', 0.76), t: '#8f98a6' });
  for (let i = 0; i < 2; i++) k.poly([P(0.12 + i * 0.22, 0.48, 0), P(0.28 + i * 0.22, 0.48, 0), P(0.28 + i * 0.22, 0.48, 13), P(0.12 + i * 0.22, 0.48, 13)], C('#4a5568'));
  for (let i = 0; i < 4; i++) circ(P(0.1 + i * 0.26, 0.61, 2), 1.6, C('#333'));
  boat(k, 0.08, 0.7, 0.56, 0.16, ['#2f4a5e', '#7a2e2a', '#2f5e4a', '#3a3a4a'][v % 4], { h: 6, cabin: 10, deck: '#6a6a6a' });
  for (let i = 0; i < 9; i++) crate(k, 0.62 + (i % 3) * 0.085, 0.1 + ((i / 3) | 0) * 0.1, 0, ['#b88a52', '#a87a42', '#c49a62'][i % 3]);
  for (let i = 0; i < 3; i++) crate(k, 0.62 + i * 0.085, 0.1, 4.5, '#b88a52');
  jibCrane(k, 0.74, 0.5, 46, ['#e0a030', '#d9534a', '#3a7fc7', '#e0a030'][v % 4], -0.24, 0.24);
}
function seaContainerHarbor(k, v) {
  const { sh } = k;
  k.pad('#b8b6aa', ['#8a8574', '#bdb8a6']);
  basin(k, 0.02, 0.62, 0.96, 0.34);
  const cols = ['#d9534a', '#4a7fc7', '#d9a441', '#3a9d6e', '#e07a30', '#7a5ac0'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let s = 0; s < 1 + ((r + c + v) % 3); s++) container(k, 0.06 + c * 0.25, 0.08 + r * 0.14, s * 7, cols[(r * 3 + c + s + v) % 6]);
  boat(k, 0.06, 0.74, 0.7, 0.18, '#2f3a4a', { h: 7, cabin: 14, deck: '#7a2e2a' });                        // a container ship at the quay
  for (let i = 0; i < 4; i++) container(k, 0.26 + i * 0.12, 0.78, 7, cols[(i + v) % 6]);
  sh(0.66, 0.4, 0.24, 0.24, 70);
  gantry(k, 0.66, 0.38, 62, ['#d9534a', '#3a7fc7', '#e0a030', '#2fa89a'][v % 4], 0.3, 0.92);
}
function seaPortTerminal(k, v) {
  const { P, C, sh, ctx, line } = k;
  k.pad('#c4c8c4', null);
  basin(k, 0.02, 0.64, 0.96, 0.32);
  sh(0.06, 0.08, 0.6, 0.46, 30);
  k.box(0.06, 0.08, 0.6, 0.46, 24, k.faces('#eef1f3'));
  k.poly([P(0.06, 0.54, 3), P(0.66, 0.54, 3), P(0.66, 0.54, 22), P(0.06, 0.54, 22)], C(['#6db6de', '#68bfc0', '#7aa7d6', '#8aa4c8'][v % 4]), 'glass');
  const a = P(0.06, 0.54, 24), b = P(0.66, 0.54, 24);                              // a wave-shaped roof
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.bezierCurveTo(a[0] + 20, a[1] - 18, b[0] - 30, b[1] + 6, b[0], b[1] - 6); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fillStyle = C('#f8f8f4'); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 0.6; ctx.stroke();
  for (let i = 0; i < 4; i++) k.poly([P(0.1 + i * 0.14, 0.12, 25), P(0.22 + i * 0.14, 0.12, 25), P(0.22 + i * 0.14, 0.4, 29), P(0.1 + i * 0.14, 0.4, 29)], C('#2c4a7a'));
  boat(k, 0.06, 0.74, 0.64, 0.16, '#f4f4f0', { h: 7, cabin: 14, cabinCol: '#bfe3f0', deck: '#4f86a8' });   // a clean, electric ship
  line(P(0.08, 0.7, 2), P(0.08, 0.7, 14), C('#7fb069'), 1.2); line(P(0.08, 0.7, 14), P(0.14, 0.76, 9), C('#2e86c1'), 0.8);   // shore power hookup
  gantry(k, 0.72, 0.36, 60, '#f4f4f0', 0.3, 0.9);
  k.tree(0.9, 0.1, 3, v + 1);
}

// Per waterfront style: [homes, shops, industry] x levels 1-4.
const WF = {
  [SHORE.POND]: { [T.RES]: [pondCottage, pondHouses, pondTerraces, pondGardenTower], [T.COM]: [pondTeaHouse, pondCafe, pondInn, pondHotel], [T.IND]: [pondMill, pondBrewery, pondBottling, pondGreenhouses] },
  [SHORE.LAKE]: { [T.RES]: [lakeCabin, lakeChalets, lakeApartments, lakeTower], [T.COM]: [lakeBoathouse, lakeRestaurant, lakeLodge, lakeSpa], [T.IND]: [lakeBoatyard, lakeWharf, lakeFreight, lakeBoatWorks] },
  [SHORE.SEA]: { [T.RES]: [seaCottage, seaHolidayFlats, seaCondos, seaLuxuryTower], [T.COM]: [seaShack, seaBoardwalk, seaHotel, seaResortTower], [T.IND]: [seaFishingWharf, seaCargoDock, seaContainerHarbor, seaPortTerminal] },
};
// canvas heights, sized to the tallest picture at each level
export const WF_HEIGHTS = { [T.RES]: [120, 150, 190, 290], [T.COM]: [120, 150, 180, 290], [T.IND]: [130, 150, 170, 140] };
export function waterfrontArt(shore, kind, level) { return WF[shore][kind][level - 1]; }

export const WF_NAME = {
  [SHORE.POND]: { [T.RES]: ['', 'Pond cottage', 'Pondside houses', 'Garden terraces', 'Garden tower'], [T.COM]: ['', 'Tea house', 'Garden caf\u00e9', 'Country inn', 'Boutique hotel'], [T.IND]: ['', 'Watermill', 'Craft brewery', 'Spring water plant', 'Greenhouse campus'] },
  [SHORE.LAKE]: { [T.RES]: ['', 'Log cabin', 'Lake chalets', 'Lakeside apartments', 'Lake-view tower'], [T.COM]: ['', 'Boathouse caf\u00e9', 'Lakeside restaurant', 'Lake lodge hotel', 'Spa hotel'], [T.IND]: ['', 'Boatyard', 'Barge wharf', 'Lake freight terminal', 'Electric boat works'] },
  [SHORE.SEA]: { [T.RES]: ['', 'Beach cottage', 'Holiday apartments', 'Glass-balcony condos', 'Luxury tower'], [T.COM]: ['', 'Seafood shack', 'Boardwalk caf\u00e9s', 'Beach hotel', 'Resort tower'], [T.IND]: ['', 'Fishing wharf', 'Cargo dock', 'Container harbor', 'Port terminal'] },
};
// chimneys and steam on the waterfront pictures (same format as SMOKE in smoke.js)
export const WF_SMOKE = {
  [`${SHORE.POND}${T.RES}1`]: [{ x: 0.61, y: 0.26, h: 36, n: 5, s: 0.4, cold: true }],
  [`${SHORE.POND}${T.IND}2`]: [{ x: 0.74, y: 0.46, h: 33, n: 7, s: 0.8, steam: true }],
  [`${SHORE.LAKE}${T.RES}1`]: [{ x: 0.28, y: 0.26, h: 36, n: 5, s: 0.4, cold: true }],
  [`${SHORE.LAKE}${T.COM}3`]: [{ x: 0.79, y: 0.23, h: 76, n: 6, s: 0.5, cold: true }],
};
