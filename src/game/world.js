import { mulberry32, clamp } from './util.js';

export const N = 64;
export const T = { EMPTY: 0, ROAD: 1, RES: 2, COM: 3, IND: 4, PARK: 5, SVC: 6 };
export const TERRAIN = { GRASS: 0, WATER: 1, SAND: 2 };

function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const g = new Float32Array(33 * 33);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = sm(x - xi), fy = sm(y - yi);
    const a = g[(yi % 33) * 33 + (xi % 33)], b = g[(yi % 33) * 33 + ((xi + 1) % 33)];
    const c = g[((yi + 1) % 33) * 33 + (xi % 33)], d = g[((yi + 1) % 33) * 33 + ((xi + 1) % 33)];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

export class World {
  constructor(seed = 1) {
    this.n = N;
    this.seed = seed;
    this.terrain = new Uint8Array(N * N);
    this.tree = new Uint8Array(N * N);
    this.kind = new Uint8Array(N * N);
    this.level = new Uint8Array(N * N);
    this.variant = new Uint8Array(N * N);
    this.bt = new Uint8Array(N * N);   // utility/service building type id (0 none)
    this.bo = new Uint8Array(N * N);   // offset from anchor tile: dx | dy << 2
    this.wire = new Uint8Array(N * N); // 0 none, 1 overhead line, 2 underground cable
    this.generate(seed);
  }
  idx(x, y) { return y * N + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
  generate(seed) {
    this.seed = seed;
    const n1 = makeNoise(seed), n2 = makeNoise(seed + 77), rnd = mulberry32(seed + 5);
    this.terrain.fill(0); this.tree.fill(0); this.kind.fill(0); this.level.fill(0); this.variant.fill(0); this.bt.fill(0); this.bo.fill(0); this.wire.fill(0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const nx = x / 8, ny = y / 8;
      const v = n1(nx, ny) * 0.62 + n1(nx * 2.1, ny * 2.1) * 0.28 + n1(nx * 4.3, ny * 4.3) * 0.1;
      const dx = (x - N / 2) / (N / 2), dy = (y - N / 2) / (N / 2);
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const h = v * 0.75 + (1 - d) * 0.45;
      const i = this.idx(x, y);
      if (h < 0.43) this.terrain[i] = TERRAIN.WATER;
      else if (h < 0.47) this.terrain[i] = TERRAIN.SAND;
      else {
        const t = n2(x / 4, y / 4);
        if (t > 0.56 && rnd() < 0.7) this.tree[i] = 1 + Math.floor(rnd() * 4);
        else if (rnd() < 0.03) this.tree[i] = 1 + Math.floor(rnd() * 4);
      }
    }
  }
  buildable(x, y) { return this.inb(x, y) && this.terrain[this.idx(x, y)] !== TERRAIN.WATER; }
  roadNear(x, y, r) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const xx = x + i, yy = y + j;
      if (this.inb(xx, yy) && this.kind[this.idx(xx, yy)] === T.ROAD) return true;
    }
    return false;
  }
  isRoad(x, y) { return this.inb(x, y) && this.kind[this.idx(x, y)] === T.ROAD; }
  roadMask(x, y) {
    return (this.isRoad(x, y - 1) ? 1 : 0) | (this.isRoad(x + 1, y) ? 2 : 0) | (this.isRoad(x, y + 1) ? 4 : 0) | (this.isRoad(x - 1, y) ? 8 : 0);
  }
  toJSON() {
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
    return { seed: this.seed, terrain: b64(this.terrain), tree: b64(this.tree), kind: b64(this.kind), level: b64(this.level), variant: b64(this.variant), bt: b64(this.bt), bo: b64(this.bo), wire: b64(this.wire) };
  }
  static fromJSON(o) {
    const w = new World(o.seed);
    const un = (s, arr) => { const b = atob(s); for (let i = 0; i < arr.length && i < b.length; i++) arr[i] = b.charCodeAt(i); };
    un(o.terrain, w.terrain); un(o.tree, w.tree); un(o.kind, w.kind); un(o.level, w.level); un(o.variant, w.variant);
    if (o.bt) { un(o.bt, w.bt); un(o.bo, w.bo); }
    if (o.wire) un(o.wire, w.wire);
    return w;
  }
}
export { clamp };
