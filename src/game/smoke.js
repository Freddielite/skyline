// Animated smoke and steam. Emitters are listed per building; puffs are drawn as soft blobs that rise, drift with the wind and fade.
import { T } from './world.js';

const cache = {};
function blob(kind) {
  if (cache[kind]) return cache[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  const rgb = kind === 'steam' ? '246,248,252' : kind === 'night' ? '120,130,160' : '86,88,94';
  g.addColorStop(0, `rgba(${rgb},.95)`); g.addColorStop(0.55, `rgba(${rgb},.5)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (cache[kind] = c);
}

// local tile coordinates (x, y) and height h of each chimney; n = puffs in the plume, s = plume size
export const SMOKE = {
  [`${T.IND}2`]: [{ x: 0.84, y: 0.24, h: 88, n: 8, s: 1 }],
  [`${T.IND}3`]: [{ x: 0.21, y: 0.17, h: 104, n: 10, s: 1.25 }],
  [`${T.RES}1`]: [{ x: 0.64, y: 0.15, h: 38, n: 5, s: 0.4, cold: true }],
  s1: [{ x: 0.45, y: 0.3, h: 124, n: 11, s: 1.4 }, { x: 1.55, y: 0.45, h: 74, n: 11, s: 2.3, steam: true }],
  s18: [{ x: 0.46, y: 0.29, h: 112, n: 9, s: 1.05 }],
  s16: [{ x: 1.0, y: 1.0, h: 18, n: 4, s: 0.5, steam: true }],
};

export function drawSmoke(ctx, list, X, Y, z, t, mode, seed, wind) {
  const night = mode === 2;
  for (const e of list) {
    const sp = blob(e.steam ? 'steam' : night ? 'night' : 'smoke');
    const cnt = Math.round(e.n * 1.4);
    const ox = X + (e.x - e.y) * 32 * z, oy = Y + (e.x + e.y) * 16 * z - e.h * z;
    for (let i = 0; i < cnt; i++) {
      const age = (t * 0.24 + i / cnt + seed) % 1, rise = age * (58 + 26 * e.s) * z, drift = wind * age * (30 + 26 * age) * z;
      const r = (4.5 + age * 17 * e.s) * z, a = Math.pow(1 - age, 1.25) * (e.steam ? 0.78 : night ? 0.62 : 0.88) * (age < 0.06 ? age / 0.06 : 1);
      ctx.globalAlpha = a * (e.cold ? 0.55 : 1);
      ctx.drawImage(sp, ox + drift + Math.sin(age * 8 + i * 1.7 + seed * 5) * 2.2 * z - r, oy - rise - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
}
