// Background life: bird flocks and a weather cycle with rain and lightning (boats live in boats.js).
import { N, TERRAIN } from './world.js';

const rr = (r, a, b) => a + r() * (b - a);

export class Ambient {
  constructor(world, rnd) {
    this.w = world; this.rnd = rnd; this.birds = []; this.t = 0; this.setting = 'auto';
    this.weather = { k: 0, target: 0, timer: rr(rnd, 70, 150), flash: 0, nextFlash: 8 };
    this.drops = []; for (let i = 0; i < 280; i++) this.drops.push({ x: rnd(), y: rnd(), v: 0.8 + rnd() * 0.7 });
    this.birdT = rr(rnd, 8, 20);
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
    // weather
    const wt = this.weather;
    if (this.setting === 'rain') wt.target = 1; else if (this.setting === 'clear') wt.target = 0;
    else { wt.timer -= dt; if (wt.timer <= 0) { wt.target = wt.target > 0 ? 0 : (this.rnd() < 0.45 ? 1 : 0); wt.timer = wt.target ? rr(this.rnd, 40, 90) : rr(this.rnd, 90, 220); } }
    wt.k += Math.sign(wt.target - wt.k) * Math.min(Math.abs(wt.target - wt.k), dt * 0.16);
    wt.flash = Math.max(0, wt.flash - dt * 3);
    if (wt.k > 0.7 && !this.snow) { wt.nextFlash -= dt; if (wt.nextFlash <= 0) { wt.flash = 1; wt.nextFlash = rr(this.rnd, 7, 18); } }
  }
}
