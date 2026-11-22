// Life on the water: every lake and pond gets boats that suit its size, and more of them as the city grows.
// Ponds get ducks and rowboats, lakes get sailboats and fishing boats, big water gets motorboats too.
import { N, TERRAIN } from './world.js';

const rr = (r, a, b) => a + r() * (b - a);
export const BOAT_TYPES = {
  duck: { sp: [0.05, 0.09], look: 0.3, clear: 0, wander: 0.9 },
  row: { sp: [0.1, 0.17], look: 0.45, clear: 0, wander: 0.35 },
  pedal: { sp: [0.09, 0.14], look: 0.45, clear: 0, wander: 0.4 },
  fish: { sp: [0.16, 0.26], look: 0.9, clear: 1, wander: 0.15 },
  sail: { sp: [0.3, 0.5], look: 1.1, clear: 1, wander: 0.12 },
  motor: { sp: [0.55, 0.85], look: 1.3, clear: 2, wander: 0.1 },
};

// Which boats a body of water of a given size holds, in the order they appear as the city grows.
function plan(size) {
  if (size < 4) return [];
  if (size < 16) return size < 8 ? ['duck'] : ['duck', 'row'];
  if (size < 61) return ['row', 'duck', 'pedal'];
  if (size < 251) return ['sail', 'row', 'fish', 'duck', 'sail'];
  const big = ['sail', 'motor', 'fish', 'sail', 'motor', 'row', 'sail', 'fish', 'motor'];
  return big.slice(0, Math.min(big.length, 4 + Math.floor(size / 300)));
}

export class Fleet {
  constructor(world, rnd) {
    this.w = world; this.rnd = rnd; this.boats = []; this.t = 0; this.checkT = 0;
    // bodies of water (4-connected), with the tiles each one has
    const seen = new Uint8Array(N * N); this.bodies = [];
    for (let s = 0; s < N * N; s++) {
      if (seen[s] || world.terrain[s] !== TERRAIN.WATER) continue;
      const tiles = [], stack = [s]; seen[s] = 1;
      while (stack.length) {
        const c = stack.pop(), x = c % N, y = (c / N) | 0; tiles.push(c);
        for (const q of [x > 0 ? c - 1 : -1, x < N - 1 ? c + 1 : -1, y > 0 ? c - N : -1, y < N - 1 ? c + N : -1]) if (q >= 0 && !seen[q] && world.terrain[q] === TERRAIN.WATER) { seen[q] = 1; stack.push(q); }
      }
      const types = plan(tiles.length);
      if (types.length) this.bodies.push({ id: this.bodies.length, tiles, types, boats: [] });
    }
    this.balance(0, true);
  }
  isWater(x, y) { return x >= 0 && y >= 0 && x < N && y < N && this.w.terrain[Math.floor(y) * N + Math.floor(x)] === TERRAIN.WATER; }
  clearAround(c, r) {
    const x = c % N, y = (c / N) | 0;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (!this.isWater(x + i + 0.5, y + j + 0.5)) return false;
    return true;
  }
  spawn(body, type) {
    const T = BOAT_TYPES[type];
    for (let n = 0; n < 30; n++) {
      const c = body.tiles[Math.floor(this.rnd() * body.tiles.length)];
      if (!this.clearAround(c, T.clear)) continue;
      const b = { type, body: body.id, x: (c % N) + 0.3 + this.rnd() * 0.4, y: ((c / N) | 0) + 0.3 + this.rnd() * 0.4, a: this.rnd() * 6.28, sp: rr(this.rnd, T.sp[0], T.sp[1]), col: Math.floor(this.rnd() * 5), fade: 0, leaving: false, n: type === 'duck' ? 2 + Math.floor(this.rnd() * 3) : 0 };
      body.boats.push(b); this.boats.push(b); return b;
    }
    return null;
  }
  // Keep each body at its target number of boats. A boat that is no longer needed fades away.
  balance(pop, instant) {
    const f = 0.35 + 0.65 * Math.min(1, pop / 2000);
    for (const body of this.bodies) {
      const want = Math.max(1, Math.round(body.types.length * f)), live = body.boats.filter((b) => !b.leaving);
      if (live.length < want) { const b = this.spawn(body, body.types[live.length]); if (b && instant) b.fade = 1; }
      else if (live.length > want) live[live.length - 1].leaving = true;
    }
  }
  update(dt, pop) {
    if (dt <= 0) return;
    this.t += dt; this.checkT += dt;
    if (this.checkT > 3) { this.checkT = 0; this.balance(pop); }
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const b = this.boats[i], T = BOAT_TYPES[b.type];
      b.fade = b.leaving ? b.fade - dt * 0.5 : Math.min(1, b.fade + dt * 0.5);
      if (b.fade <= 0 && b.leaving) { this.boats.splice(i, 1); const body = this.bodies[b.body]; body.boats.splice(body.boats.indexOf(b), 1); continue; }
      const cx = Math.cos(b.a), cy = Math.sin(b.a), nx = b.x + cx * b.sp * dt, ny = b.y + cy * b.sp * dt;
      if (this.isWater(nx + cx * T.look, ny + cy * T.look) && this.isWater(nx, ny)) {
        b.x = nx; b.y = ny; b.moving = true;
        b.a += Math.sin(this.t * 0.3 + b.col * 1.7) * T.wander * dt;
      } else { b.a += (b.col % 2 ? 1 : -1) * rr(this.rnd, 0.8, 2.2) * dt * 2.5; b.moving = false; }
    }
  }
}
