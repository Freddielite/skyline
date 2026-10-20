// Background life: bird flocks, boats on the water and a weather cycle with rain and lightning.
import { N, TERRAIN } from './world.js';

const rr = (r, a, b) => a + r() * (b - a);

export class Ambient {
  constructor(world, rnd) {
    this.w = world; this.rnd = rnd; this.birds = []; this.boats = []; this.t = 0; this.setting = 'auto';
    this.weather = { k: 0, target: 0, timer: rr(rnd, 70, 150), flash: 0, nextFlash: 8 };
    this.drops = []; for (let i = 0; i < 280; i++) this.drops.push({ x: rnd(), y: rnd(), v: 0.8 + rnd() * 0.7 });
    this.birdT = rr(rnd, 8, 20);
    const water = [];
    for (let y = 3; y < N - 3; y++) for (let x = 3; x < N - 3; x++) {
      let ok = true; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (world.terrain[(y + dy) * N + x + dx] !== TERRAIN.WATER) { ok = false; break; }
      if (ok) water.push([x, y]);
    }
    this.waterSpots = water;
    const n = Math.min(7, Math.floor(water.length / 18));
    for (let i = 0; i < n; i++) { const [x, y] = water[Math.floor(rnd() * water.length)]; this.boats.push({ x: x + 0.5, y: y + 0.5, a: rnd() * 6.28, sp: 0.35 + rnd() * 0.3, sail: rnd() < 0.6, col: Math.floor(rnd() * 5), turn: 0 }); }
  }
  isWater(x, y) { return x >= 0 && y >= 0 && x < N && y < N && this.w.terrain[Math.floor(y) * N + Math.floor(x)] === TERRAIN.WATER; }
  update(dt, mode) {
    if (dt <= 0) return;
    this.t += dt;
    // birds
    this.birdT -= dt;
    if (this.birdT <= 0 && mode === 0 && this.birds.length < 2) {
      this.birdT = rr(this.rnd, 25, 55);
      const side = Math.floor(this.rnd() * 2), u = rr(this.rnd, 10, N - 10), sp = rr(this.rnd, 3, 4.5);
      const x = side ? -8 : u, y = side ? u : -8, tx = side ? N + 10 : u + rr(this.rnd, -10, 10), ty = side ? u + rr(this.rnd, -10, 10) : N + 10, d = Math.hypot(tx - x, ty - y);
      const f = { x, y, vx: ((tx - x) / d) * sp, vy: ((ty - y) / d) * sp, h: rr(this.rnd, 70, 110), n: 5 + Math.floor(this.rnd() * 5), seed: this.rnd() * 10 };
      this.birds.push(f);
    }
    for (let i = this.birds.length - 1; i >= 0; i--) { const f = this.birds[i]; f.x += f.vx * dt; f.y += f.vy * dt; if (f.x > N + 14 || f.y > N + 14 || f.x < -14 || f.y < -14) this.birds.splice(i, 1); }
    // boats
    for (const b of this.boats) {
      const nx = b.x + Math.cos(b.a) * b.sp * dt, ny = b.y + Math.sin(b.a) * b.sp * dt;
      if (this.isWater(nx + Math.cos(b.a) * 1.2, ny + Math.sin(b.a) * 1.2) && this.isWater(nx, ny)) { b.x = nx; b.y = ny; b.turn = Math.max(0, b.turn - dt); b.a += Math.sin(this.t * 0.3 + b.col) * 0.12 * dt; }
      else b.a += (this.rnd() < 0.5 ? 1 : -1) * rr(this.rnd, 0.6, 2) * dt * 4;
    }
    // weather
    const wt = this.weather;
    if (this.setting === 'rain') wt.target = 1; else if (this.setting === 'clear') wt.target = 0;
    else { wt.timer -= dt; if (wt.timer <= 0) { wt.target = wt.target > 0 ? 0 : (this.rnd() < 0.45 ? 1 : 0); wt.timer = wt.target ? rr(this.rnd, 40, 90) : rr(this.rnd, 90, 220); } }
    wt.k += Math.sign(wt.target - wt.k) * Math.min(Math.abs(wt.target - wt.k), dt * 0.16);
    wt.flash = Math.max(0, wt.flash - dt * 3);
    if (wt.k > 0.7) { wt.nextFlash -= dt; if (wt.nextFlash <= 0) { wt.flash = 1; wt.nextFlash = rr(this.rnd, 7, 18); } }
  }
}
