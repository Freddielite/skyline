// Construction-site animations. Every kind of building gets its own build process.
import { T } from './world.js';
import { BT } from './buildings.js';

const c01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => t * t * (3 - 2 * t);
const hsh = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

// style: how the site looks and moves
export const STYLES = {
  frame: { scaf: '#b98a52', brace: '#8d6a3a', net: 'rgba(143,201,122,.22)', mixer: true, workers: 3 },
  crane: { scaf: '#aeb7c2', brace: '#8f9aa8', crane: 'tower', panels: true, workers: 2, load: '#9fd4f0' },
  heavy: { scaf: '#f4c542', brace: '#2b2e36', crane: 'tower', sparks: true, excavator: true, workers: 3, load: '#7b8794' },
  civic: { scaf: '#9fb4c8', brace: '#7d92a8', net: 'rgba(111,168,220,.22)', crane: 'mobile', sign: true, workers: 2, load: '#e9ecf0' },
  turbine: { crane: 'mobile', blades: true, workers: 2, load: '#f4f6f8' },
  earth: { excavator: true, piles: true, wipe: true, workers: 2 },
};
const REAL_H = { [T.RES]: [30, 54, 94], [T.COM]: [32, 66, 140], [T.IND]: [30, 46, 104], [T.PARK]: [22, 22, 22] };
const SVC_H = { busstop: 30, busterm: 46, pump: 52, treat: 80, coal: 120, wind: 78, water: 66, police: 34, fire: 54, clinic: 48, school: 66, police2: 58, fire2: 92, hospital: 82, university: 104, plaza: 12, library: 40, museum: 60, stadium: 80, dump: 22, recycle: 40, wte: 112 };

export function siteInfo(ev) {
  if (ev.bt) {
    const def = BT[ev.bt], k = def.key;
    const style = k === 'wind' ? 'turbine' : (k === 'dump' || k === 'plaza') ? 'earth' : (k === 'coal' || k === 'wte' || k === 'recycle') ? 'heavy' : (k === 'stadium' || k === 'hospital' || k === 'university' || k === 'treat') ? 'crane' : (k === 'water') ? 'frame' : 'civic';
    return { style, fw: def.w, fd: def.d, hb: SVC_H[k] || 50, dur: k === 'wind' ? 7 : Math.min(24, 8 + def.cost / 600) };
  }
  if (ev.kind === T.PARK) return { style: 'earth', fw: 1, fd: 1, hb: 22, dur: 4.5 };
  const style = ev.kind === T.RES ? 'frame' : ev.kind === T.COM ? 'crane' : 'heavy';
  const L = ev.to - 1;
  return { style, fw: 1, fd: 1, hb: REAL_H[ev.kind][L], dur: [5, 8.5, 13][L] * (ev.kind === T.COM ? 1.1 : 1) };
}

export function drawConstruction(ctx, s, AX, AY, z, mode, now, spNew, spOld) {
  const st = STYLES[s.style], p = c01(s.t / s.dur), fw = s.fw, fd = s.fd, hb = s.hb, d = mode === 2 ? 0.5 : mode === 1 ? 0.86 : 1;
  const P = (x, y, h = 0) => [AX + (x - y) * 32 * z, AY + (x + y) * 16 * z - h * z];
  const col = (hex, a = 1) => { const h = parseInt(hex.slice(1), 16); return `rgba(${(((h >> 16) & 255) * d) | 0},${(((h >> 8) & 255) * d) | 0},${((h & 255) * d) | 0},${a})`; };
  const poly = (a, f, stroke) => { ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) ctx.lineTo(a[i][0], a[i][1]); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.7 * z; ctx.stroke(); } };
  const line = (a, b, c, w = 1) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = c; ctx.lineWidth = w * z; ctx.lineCap = 'round'; ctx.stroke(); };
  const img = (sp) => ctx.drawImage(sp.c, AX - sp.ox * z, AY - sp.oy * z, (sp.c.width / sp.S) * z, (sp.c.height / sp.S) * z);
  const fadeOut = p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1;
  const new0 = s.from === 0;
  const baseY = AY + (fw + fd) * 16 * z;
  const r = ease(c01((p - 0.1) / 0.78));

  // 1. what stands there already (upgrades keep the old building until the new one rises over it)
  if (spOld) img(spOld);

  // 2. groundworks
  if (new0) {
    const k = c01((p - 0.22) / 0.18);                     // dirt fades as the building rises
    const gx = 0.04;
    ctx.globalAlpha = 1 - k;
    poly([P(-gx, -gx), P(fw + gx, -gx), P(fw + gx, fd + gx), P(-gx, fd + gx)], col(s.style === 'earth' ? '#8a7650' : '#9b8466'));
    if (p < 0.2) poly([P(0.14, 0.14), P(fw - 0.14, 0.14), P(fw - 0.14, fd - 0.14), P(0.14, fd - 0.14)], col('#6f5d45'));
    ctx.globalAlpha = 1;
    // fence with hazard tape
    if (p < 0.92) {
      const post = [[-0.05, -0.05], [fw * 0.5, -0.05], [fw + 0.05, -0.05], [fw + 0.05, fd * 0.5], [fw + 0.05, fd + 0.05], [fw * 0.5, fd + 0.05], [-0.05, fd + 0.05], [-0.05, fd * 0.5]];
      ctx.globalAlpha = fadeOut;
      for (let i = 0; i < post.length; i++) { const a = P(post[i][0], post[i][1]), b = P(post[(i + 1) % post.length][0], post[(i + 1) % post.length][1]); line(a, [a[0], a[1] - 7 * z], col('#7a6a55'), 1.6); line([a[0], a[1] - 6 * z], [b[0], b[1] - 6 * z], col(i % 2 ? '#f4c542' : '#2b2e36'), 1.3); }
      ctx.globalAlpha = 1;
    }
    if (st.piles || p < 0.25) {
      const pile = (x, y, r2) => { const q = P(x, y); ctx.fillStyle = col('#a68d68'); ctx.beginPath(); ctx.ellipse(q[0], q[1], r2 * z, r2 * 0.5 * z, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = col('#bba37c'); ctx.beginPath(); ctx.ellipse(q[0] - z, q[1] - 2 * z, r2 * 0.6 * z, r2 * 0.3 * z, 0, 0, 6.3); ctx.fill(); };
      pile(fw - 0.12, 0.2, 8); pile(0.15, fd - 0.15, 6);
    }
  }

  // 3. the building itself, revealed from the ground up (earthworks wipe outward instead)
  if (r > 0) {
    ctx.save();
    ctx.beginPath();
    if (st.wipe) { const c = P(fw / 2, fd / 2); const R = r * 70 * (fw + fd) / 2 * z; ctx.ellipse(c[0], c[1], R, R * 0.55, 0, 0, 6.3); }
    else { const top = baseY - hb * r * z - 6 * z; ctx.rect(AX - 260 * z, top, 520 * z, baseY + 90 * z - top); }
    ctx.clip(); img(spNew); ctx.restore();
  }

  // 4. scaffolding that climbs with the walls
  if (st.scaf && p < 0.93 && r > 0) {
    const hs = hb * r + 10, a = fadeOut, g = 0.07;
    const X0 = -g, X1 = fw + g, Y0 = -g, Y1 = fd + g;
    ctx.globalAlpha = a;
    for (const [x, y] of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]]) line(P(x, y), P(x, y, hs), col(st.scaf), 1.5);
    const faces = [[X0, Y1, X1, Y1], [X1, Y0, X1, Y1]];
    for (const [ax, ay, bx, by] of faces) {
      if (st.net) poly([P(ax, ay, 0), P(bx, by, 0), P(bx, by, hs), P(ax, ay, hs)], st.net);
      const rungs = Math.floor(hs / 11);
      for (let k = 0; k <= rungs; k++) { const h = k * 11; line(P(ax, ay, h), P(bx, by, h), col(s.style === 'heavy' && k % 2 ? '#2b2e36' : st.scaf), 1.1); if (k < rungs) line(P(ax, ay, h), P(bx, by, h + 11), col(st.brace), 0.8); }
      const n = Math.max(1, Math.round((Math.abs(bx - ax) + Math.abs(by - ay)) * 2));
      for (let k = 1; k < n; k++) { const u = k / n; line(P(ax + (bx - ax) * u, ay + (by - ay) * u), P(ax + (bx - ax) * u, ay + (by - ay) * u, hs), col(st.scaf), 1); }
    }
    ctx.globalAlpha = 1;
  }

  // 5. cranes
  if (st.crane && p < 0.95) {
    ctx.globalAlpha = p > 0.9 ? 1 - (p - 0.9) / 0.05 : 1;
    const sw = Math.sin(now * 0.9), load = col(st.load || '#999');
    if (st.crane === 'tower') {
      const mx = -0.12, my = fd * 0.45, Hc = hb + 38, mast = P(mx, my, 0), top = P(mx, my, Hc);
      line([mast[0] - 2.5 * z, mast[1]], [top[0] - 2.5 * z, top[1]], col('#e8a521'), 1.2); line([mast[0] + 2.5 * z, mast[1]], [top[0] + 2.5 * z, top[1]], col('#e8a521'), 1.2);
      for (let h = 0; h < Hc; h += 9) { line([mast[0] - 2.5 * z, mast[1] - h * z], [mast[0] + 2.5 * z, mast[1] - (h + 9) * z], col('#c88a18'), 0.8); }
      const jx = fw + 0.5, je = P(jx, my, Hc), cj = P(mx - 0.45, my, Hc);
      line(cj, je, col('#e8a521'), 1.6); line(top, [top[0], top[1] - 9 * z], col('#e8a521'), 1.2); line([top[0], top[1] - 9 * z], je, col('#d9a441'), 0.7); line([top[0], top[1] - 9 * z], cj, col('#d9a441'), 0.7);
      poly([[cj[0] - 4 * z, cj[1]], [cj[0] + 4 * z, cj[1]], [cj[0] + 4 * z, cj[1] + 6 * z], [cj[0] - 4 * z, cj[1] + 6 * z]], col('#6b7280'));
      const sT = 0.5 + 0.3 * sw, hx = top[0] + (je[0] - top[0]) * sT, hy = top[1] + (je[1] - top[1]) * sT;
      const drop = (hb * r * 0.6 + 14 + 9 * Math.sin(now * 1.4)) * z;
      line([hx, hy], [hx, hy + drop], col('#2b2e36'), 0.7);
      poly([[hx - 5 * z, hy + drop], [hx + 5 * z, hy + drop], [hx + 5 * z, hy + drop + 4 * z], [hx - 5 * z, hy + drop + 4 * z]], load, col('#00000040'));
    } else {
      const bx = fw + 0.5, by = fd * 0.5, b0 = P(bx, by, 4), tip = P(fw * 0.55, by, Math.max(26, hb * r + 20));
      poly([P(bx - 0.08, by - 0.2, 0), P(bx + 0.25, by - 0.2, 0), P(bx + 0.25, by + 0.2, 0), P(bx - 0.08, by + 0.2, 0)], col('#e8a521'));
      poly([P(bx - 0.05, by - 0.12, 7), P(bx + 0.12, by - 0.12, 7), P(bx + 0.12, by + 0.12, 7), P(bx - 0.05, by + 0.12, 7)], col('#c88a18'));
      line(b0, tip, col('#e8a521'), 2); line(b0, [tip[0] + 5 * z, tip[1] + 4 * z], col('#b97d12'), 0.8);
      const hang = (14 + 5 * Math.sin(now * 1.5)) * z;
      line(tip, [tip[0], tip[1] + hang], col('#2b2e36'), 0.7);
      poly([[tip[0] - 5 * z, tip[1] + hang], [tip[0] + 5 * z, tip[1] + hang], [tip[0] + 5 * z, tip[1] + hang + 3 * z], [tip[0] - 5 * z, tip[1] + hang + 3 * z]], load);
    }
    ctx.globalAlpha = 1;
  }
  if (st.blades && p < 0.92) {                           // turbine blades wait on the ground until the very end
    for (let i = 0; i < 3; i++) { const a = P(-0.35 + i * 0.06, 0.2 + i * 0.28), b = P(-0.35 + i * 0.06 + 0.5, 0.2 + i * 0.28 + 0.1); line(a, b, col('#f4f6f8'), 3); }
  }

  // 6. diggers, mixers, panels, sign
  if (st.excavator && p < 0.9) {
    const e = P(0.35, fd - 0.3), swing = Math.sin(now * 1.8), a = fadeOut;
    ctx.globalAlpha = a;
    poly([[e[0] - 8 * z, e[1] - 1 * z], [e[0] + 8 * z, e[1] - 1 * z], [e[0] + 8 * z, e[1] + 2 * z], [e[0] - 8 * z, e[1] + 2 * z]], col('#2b2e36'));
    poly([[e[0] - 6 * z, e[1] - 8 * z], [e[0] + 4 * z, e[1] - 8 * z], [e[0] + 4 * z, e[1] - 1 * z], [e[0] - 6 * z, e[1] - 1 * z]], col('#f4c542'));
    poly([[e[0] - 4 * z, e[1] - 11 * z], [e[0] + 2 * z, e[1] - 11 * z], [e[0] + 2 * z, e[1] - 8 * z], [e[0] - 4 * z, e[1] - 8 * z]], col('#cfe6f3'));
    const j1 = [e[0] + 4 * z, e[1] - 8 * z], j2 = [j1[0] + (8 + 3 * swing) * z, j1[1] - (5 - 3 * swing) * z], j3 = [j2[0] + 6 * z, j2[1] + (8 + 4 * swing) * z];
    line(j1, j2, col('#e0b526'), 2); line(j2, j3, col('#e0b526'), 1.6); poly([[j3[0] - 2 * z, j3[1]], [j3[0] + 3 * z, j3[1]], [j3[0] + 2 * z, j3[1] + 3 * z], [j3[0] - 2 * z, j3[1] + 3 * z]], col('#8b929c'));
    ctx.globalAlpha = 1;
  }
  if (st.mixer && p < 0.92) {
    const m = P(fw + 0.18, 0.3), rot = now * 3;
    ctx.fillStyle = col('#f08a2b'); ctx.beginPath(); ctx.ellipse(m[0], m[1] - 6 * z, 5 * z, 6 * z, -0.4, 0, 6.3); ctx.fill();
    ctx.strokeStyle = col('#ffffff', 0.8); ctx.lineWidth = z; ctx.beginPath(); ctx.moveTo(m[0] + Math.cos(rot) * 4 * z, m[1] - 6 * z + Math.sin(rot) * 4 * z); ctx.lineTo(m[0] - Math.cos(rot) * 4 * z, m[1] - 6 * z - Math.sin(rot) * 4 * z); ctx.stroke();
    line([m[0] - 3 * z, m[1]], [m[0] - 3 * z, m[1] - 2 * z], col('#555'), 1.5); line([m[0] + 3 * z, m[1]], [m[0] + 3 * z, m[1] - 2 * z], col('#555'), 1.5);
    const bk = P(fw + 0.12, 0.7);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = col(i % 2 ? '#b5523a' : '#a64a34'); ctx.fillRect(bk[0] - 6 * z + (i % 3) * 4 * z, bk[1] - 3 * z - Math.floor(i / 3) * 2.4 * z, 3.8 * z, 2.2 * z); }
  }
  if (st.panels && p < 0.9) { const q = P(fw + 0.2, fd - 0.3); for (let i = 0; i < 3; i++) poly([[q[0] - 6 * z, q[1] - (2 + i * 3) * z], [q[0] + 6 * z, q[1] - (2 + i * 3) * z - 3 * z], [q[0] + 6 * z, q[1] - (4 + i * 3) * z - 3 * z], [q[0] - 6 * z, q[1] - (4 + i * 3) * z]], col('#9fd4f0'), col('#ffffff', 0.6)); }
  if (st.sign && p < 0.92) { const q = P(fw + 0.08, fd + 0.12); line(q, [q[0], q[1] - 12 * z], col('#7a6a55'), 1.2); poly([[q[0] - 8 * z, q[1] - 12 * z], [q[0] + 8 * z, q[1] - 12 * z], [q[0] + 8 * z, q[1] - 5 * z], [q[0] - 8 * z, q[1] - 5 * z]], col('#f4c542'), col('#2b2e36')); line([q[0] - 6 * z, q[1] - 8.5 * z], [q[0] + 6 * z, q[1] - 8.5 * z], col('#2b2e36'), 1.2); }

  // 7. workers with hard hats
  if (p < 0.94) {
    const shirts = ['#e0483f', '#3a7bd5', '#27ae60', '#e67e22'];
    for (let i = 0; i < st.workers; i++) {
      const ph = i * 2.1 + hsh(s.i, i) * 6, rx = 0.18 + 0.12 * (i % 2), q = P(fw * 0.5 + Math.cos(now * 0.6 + ph) * (fw * 0.5 + 0.12) * 0.8, fd * 0.5 + Math.sin(now * 0.6 + ph) * (fd * 0.5 + 0.12) * 0.8);
      const bob = Math.abs(Math.sin(now * 6 + ph)) * 0.8 * z; ctx.globalAlpha = fadeOut;
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(q[0] + 2 * z, q[1] + 0.4 * z, 2.6 * z, 1.1 * z, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = col('#2f3340'); ctx.fillRect(q[0] - 1.1 * z, q[1] - 1.6 * z - bob, 0.9 * z, 1.8 * z); ctx.fillRect(q[0] + 0.2 * z, q[1] - 1.6 * z - bob, 0.9 * z, 1.8 * z);
      ctx.fillStyle = col(shirts[i % 4]); ctx.fillRect(q[0] - 1.3 * z, q[1] - 6 * z - bob, 2.6 * z, 4.6 * z);
      ctx.fillStyle = col('#e0b48c'); ctx.beginPath(); ctx.arc(q[0], q[1] - 7.4 * z - bob, 1.6 * z, 0, 6.3); ctx.fill();
      ctx.fillStyle = col('#f4c542'); ctx.beginPath(); ctx.arc(q[0], q[1] - 7.9 * z - bob, 1.9 * z, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // 8. sparks, dust
  if (st.sparks && p > 0.1 && p < 0.9) {
    const t = Math.floor(now * 22), top = P(fw * 0.5, fd + 0.05, hb * r * 0.8 + 6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const a = hsh(t, i) * 6.3, rad = hsh(t, i + 9) * 7 * z; ctx.fillStyle = `rgba(255,${190 + hsh(t, i) * 60 | 0},90,${0.6 + hsh(t, i + 3) * 0.4})`; ctx.beginPath(); ctx.arc(top[0] + Math.cos(a) * rad, top[1] + Math.sin(a) * rad, (0.7 + hsh(t, i + 5)) * z, 0, 6.3); ctx.fill(); }
    const gl = ctx.createRadialGradient(top[0], top[1], 0, top[0], top[1], 12 * z); gl.addColorStop(0, 'rgba(255,220,140,.5)'); gl.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = gl; ctx.fillRect(top[0] - 12 * z, top[1] - 12 * z, 24 * z, 24 * z);
    ctx.restore();
  }
  if (p < 0.96) {
    for (let i = 0; i < 5; i++) {
      const ph = (now * 0.45 + i * 0.2 + hsh(s.i, i)) % 1, q = P(hsh(i, s.i) * fw, hsh(s.i, i + 4) * fd, 0);
      ctx.fillStyle = `rgba(190,170,140,${(1 - ph) * 0.3 * fadeOut})`; ctx.beginPath(); ctx.arc(q[0] + ph * 6 * z, q[1] - ph * 22 * z, (3 + ph * 7) * z, 0, 6.3); ctx.fill();
    }
  }

  // 9. ta-da: ring and sparkles when it opens
  if (p > 0.9) {
    const q = (p - 0.9) / 0.1, c = P(fw / 2, fd / 2), R = (22 + 60 * q) * (fw + fd) / 2 * z;
    ctx.strokeStyle = `rgba(255,255,255,${(1 - q) * 0.85})`; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.ellipse(c[0], c[1], R, R * 0.5, 0, 0, 6.3); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3, sp = P(fw / 2 + Math.cos(a) * (fw * 0.5 + 0.2), fd / 2 + Math.sin(a) * (fd * 0.5 + 0.2), hb * 0.5 + q * 20), L = 3.5 * z * (1 - q); ctx.strokeStyle = `rgba(255,255,255,${1 - q})`; ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.moveTo(sp[0] - L, sp[1]); ctx.lineTo(sp[0] + L, sp[1]); ctx.moveTo(sp[0], sp[1] - L); ctx.lineTo(sp[0], sp[1] + L); ctx.stroke(); }
  }
  // 10. progress bar
  if (p < 0.95 && z > 0.55) {
    const b = P(fw / 2, fd / 2, hb * r + 18), w = 26 * z;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(b[0] - w / 2, b[1], w, 3.4 * z); ctx.fillStyle = '#f2b84b'; ctx.fillRect(b[0] - w / 2, b[1], w * p, 3.4 * z);
  }
}
