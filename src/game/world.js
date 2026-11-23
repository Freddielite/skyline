import { mulberry32, clamp } from './util.js';

export const N = 96;
export const T = { EMPTY: 0, ROAD: 1, RES: 2, COM: 3, IND: 4, PARK: 5, SVC: 6 };
export const TERRAIN = { GRASS: 0, WATER: 1, SAND: 2 };
export const SHORE = { NONE: 0, POND: 1, LAKE: 2, SEA: 3 };
export const SHORE_NAME = ['', 'Pond', 'Lake', 'Sea'];
const POND_MIN = 4, LAKE_MIN = 16, SEA_MIN = 251;                   // body sizes in water tiles

function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const g = new Float32Array(80 * 80);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = sm(x - xi), fy = sm(y - yi);
    const a = g[(yi % 80) * 80 + (xi % 80)], b = g[(yi % 80) * 80 + ((xi + 1) % 80)];
    const c = g[((yi + 1) % 80) * 80 + (xi % 80)], d = g[((yi + 1) % 80) * 80 + ((xi + 1) % 80)];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

export class World {
  constructor(seed = 1, map = 'classic') {
    this.n = N; this.map = map;
    this.seed = seed;
    this.terrain = new Uint8Array(N * N);
    this.tree = new Uint8Array(N * N);
    this.kind = new Uint8Array(N * N);
    this.level = new Uint8Array(N * N);
    this.variant = new Uint8Array(N * N);
    this.bt = new Uint8Array(N * N);   // utility/service building type id (0 none)
    this.bo = new Uint8Array(N * N);   // offset from anchor tile: dx | dy << 2
    this.wire = new Uint8Array(N * N); // 0 none, 1 overhead line, 2 underground cable
    this.pipe = new Uint8Array(N * N); // 1 = underground water pipe
    this.wear = new Uint8Array(N * N); // road wear 0..100 (0.9.0)
    this.fix = new Uint8Array(N * N);  // road repair: 1 one lane closed, 2 road closed (0.9.0)
    this.hw = new Uint8Array(N * N);   // 1 = regional highway (the city's link to the outside world)
    this.tone = new Uint8Array(N * N); // derived, not saved: grass shade 0..5 (dry to lush)
    this.depth = new Uint8Array(N * N);// derived, not saved: water depth 0..3 (shallows to deep)
    this.shore = new Uint8Array(N * N);// derived, not saved: the water a land tile is close to (SHORE.NONE/POND/LAKE/SEA)
    this.generate(seed, map);
    this.ensureHighway();
    this.derive();
  }
  idx(x, y) { return y * N + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
  // Map kinds, chosen on the start screen:
  //   coast   - a sea along one edge of the map, plus a few ponds inland
  //   lake    - two or three lakes inland (each under 251 tiles, so they stay lakes), a few ponds, no sea
  //   country - green farmland dotted with ponds and a small lake or two
  //   classic - the original island map (older saves and the first launch)
  generate(seed, map = 'classic') {
    this.seed = seed; this.map = map;
    const n1 = makeNoise(seed), n2 = makeNoise(seed + 77), n3 = makeNoise(seed + 151), rnd = mulberry32(seed + 5);
    this.terrain.fill(0); this.tree.fill(0); this.kind.fill(0); this.level.fill(0); this.variant.fill(0); this.bt.fill(0); this.bo.fill(0); this.wire.fill(0); this.pipe.fill(0); this.wear.fill(0); this.fix.fill(0); if (this.hw) this.hw.fill(0);
    const bodies = [], side = Math.floor(rnd() * 4), mr = mulberry32(seed + 19);
    const place = (n, r0, r1, wob, slope, margin) => {          // waters of a given size, kept apart from each other
      for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
        const r = r0 + mr() * (r1 - r0), x = margin + mr() * (N - 2 * margin), y = margin + mr() * (N - 2 * margin);
        if (bodies.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + r + 6)) continue;
        if (map === 'coast' && [y, N - x, N - y, x][side] < N * 0.3 + r) continue;   // ponds stay away from the sea
        bodies.push({ x, y, r, wob, slope }); k++;
      }
    };
    if (map === 'lake') { place(2 + (mr() < 0.5 ? 1 : 0), 6.2, 7.6, 0.45, 0.32, 16); place(3, 1.4, 1.95, 0.3, 0.5, 8); }
    else if (map === 'country') { place(1 + (mr() < 0.5 ? 1 : 0), 3.2, 4.4, 0.4, 0.4, 12); place(7 + Math.floor(mr() * 4), 1.4, 1.95, 0.3, 0.5, 6); }
    else if (map === 'coast') place(2 + Math.floor(mr() * 2), 1.4, 1.95, 0.3, 0.5, 8);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const nx = x / 8, ny = y / 8;
      const v = n1(nx, ny) * 0.62 + n1(nx * 2.1, ny * 2.1) * 0.28 + n1(nx * 4.3, ny * 4.3) * 0.1;
      let h;
      if (map === 'classic') {
        const dx = (x - N / 2) / (N / 2), dy = (y - N / 2) / (N / 2);
        const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
        h = v * 0.75 + (1 - d) * 0.45;
      } else {
        h = 0.62 + (v - 0.5) * 0.3;
        if (map === 'coast') { const e = [y, N - 1 - x, N - 1 - y, x][side] / N; h = Math.min(h, 0.2 + e * 1.25 + (v - 0.5) * 0.45); }
        for (const b of bodies) {
          const d = Math.hypot(x - b.x, y - b.y) / b.r + (n3(x / 4, y / 4) - 0.5) * b.wob;
          h = Math.min(h, 0.43 - b.slope * 0.1 + (d - 1) * b.slope);
        }
      }
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
  // The highway enters from the map edge with the shortest crossing over water. On a fresh map it runs a few
  // tiles onto land; on an older save it is routed through empty ground to the nearest existing road.
  ensureHighway() {
    if (this.hw.some((v) => v)) return;
    let best = null;
    for (let side = 0; side < 4; side++) for (let o = -24; o <= 24; o += 2) {
      const u = (N >> 1) + o, path = [];
      let water = 0, land = 0;
      for (let s = 0; s < N >> 1; s++) {
        const x = side === 0 ? u : side === 1 ? N - 1 - s : side === 2 ? u : s;
        const y = side === 0 ? s : side === 1 ? u : side === 2 ? N - 1 - s : u;
        const i = this.idx(x, y); path.push(i);
        if (this.terrain[i] === TERRAIN.WATER) { if (land) break; water++; } else land++;
        if (land >= 8) break;
      }
      if (land < 8) continue;
      const score = water * 3 + Math.abs(o) * 0.25;
      if (!best || score < best.score) best = { score, path, side };
    }
    if (!best) return;
    this.hwSide = best.side;
    const roads = this.kind.some((k) => k === T.ROAD);
    let path = best.path;
    if (roads) {                                       // older city: reach the nearest road through open ground
      const start = path[0], prev = new Int32Array(N * N).fill(-2), q = [start]; prev[start] = -1; let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h++) {
        const c = q[h], x = c % N, y = (c / N) | 0;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const xx = x + dx, yy = y + dy; if (!this.inb(xx, yy)) continue;
          const j = this.idx(xx, yy); if (prev[j] !== -2) continue;
          if (this.kind[j] === T.ROAD) { prev[j] = c; hit = j; break; }
          if (this.kind[j] !== T.EMPTY) continue;
          prev[j] = c; q.push(j);
        }
      }
      if (hit >= 0) { path = []; for (let c = prev[hit]; c !== -1; c = prev[c]) path.push(c); path.reverse(); }
    }
    for (const i of path) {
      if (this.kind[i] !== T.EMPTY && this.kind[i] !== T.ROAD) break;
      if (this.terrain[i] === TERRAIN.WATER) this.terrain[i] = TERRAIN.SAND;   // a causeway across the water
      this.kind[i] = T.ROAD; this.tree[i] = 0; this.hw[i] = 1;
    }
  }
  // Natural variation that never changes the game: grass shade from slow noise plus closeness to water,
  // and water depth from the distance to the nearest shore.
  derive() {
    const n1 = makeNoise(this.seed + 311), dist = new Int16Array(N * N).fill(-1), q = [];
    for (let i = 0; i < N * N; i++) if (this.terrain[i] !== TERRAIN.WATER) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const xx = x + dx, yy = y + dy; if (!this.inb(xx, yy)) continue; const j = this.idx(xx, yy); if (dist[j] < 0) { dist[j] = dist[c] + 1; q.push(j); } }
    }
    // distance from water for land tiles, the same way
    const wd = new Int16Array(N * N).fill(-1), q2 = [];
    for (let i = 0; i < N * N; i++) if (this.terrain[i] === TERRAIN.WATER) { wd[i] = 0; q2.push(i); }
    for (let h = 0; h < q2.length; h++) {
      const c = q2[h], x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const xx = x + dx, yy = y + dy; if (!this.inb(xx, yy)) continue; const j = this.idx(xx, yy); if (wd[j] < 0) { wd[j] = wd[c] + 1; q2.push(j); } }
    }
    for (let i = 0; i < N * N; i++) {
      const x = i % N, y = (i / N) | 0;
      if (this.terrain[i] === TERRAIN.WATER) { this.depth[i] = Math.min(3, Math.max(0, dist[i] - 1)); continue; }
      const wet = wd[i] < 0 ? 0 : Math.max(0, 1 - wd[i] / 9);
      const v = n1(x / 11, y / 11) * 0.75 + n1(x / 4.5 + 7, y / 4.5 + 3) * 0.25 + wet * 0.35 + (this.tree[i] ? 0.12 : 0);
      this.tone[i] = Math.max(0, Math.min(5, Math.floor((v - 0.2) * 6.5)));
    }
    this.deriveShore();
  }
  // Waterfront: every land tile within 2 tiles of water takes the kind of the biggest body of water it is near.
  // Sizes match the boats (boats.js): ponds of 4 to 15 tiles (smaller puddles don't count), lakes under 251, and anything bigger or reaching
  // the map edge counts as the sea.
  deriveShore() {
    const seen = new Uint8Array(N * N); this.shore.fill(0);
    for (let s = 0; s < N * N; s++) {
      if (seen[s] || this.terrain[s] !== TERRAIN.WATER) continue;
      const tiles = [], stack = [s]; seen[s] = 1; let edge = false;
      while (stack.length) {
        const c = stack.pop(), x = c % N, y = (c / N) | 0; tiles.push(c);
        if (x === 0 || y === 0 || x === N - 1 || y === N - 1) edge = true;
        for (const q of [x > 0 ? c - 1 : -1, x < N - 1 ? c + 1 : -1, y > 0 ? c - N : -1, y < N - 1 ? c + N : -1]) if (q >= 0 && !seen[q] && this.terrain[q] === TERRAIN.WATER) { seen[q] = 1; stack.push(q); }
      }
      if (tiles.length < POND_MIN && !edge) continue;   // a puddle is not a waterfront
      const tier = edge || tiles.length >= SEA_MIN ? SHORE.SEA : tiles.length >= LAKE_MIN ? SHORE.LAKE : SHORE.POND;
      for (const c of tiles) {
        const x = c % N, y = (c / N) | 0;
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
          const xx = x + i, yy = y + j; if (!this.inb(xx, yy)) continue;
          const q = yy * N + xx; if (this.terrain[q] !== TERRAIN.WATER && this.shore[q] < tier) this.shore[q] = tier;
        }
      }
    }
  }
  isHighway(i) { return this.hw[i] === 1; }
  edgeOpen(x, y) { return this.hw[this.idx(x, y)] && (x === 0 || y === 0 || x === N - 1 || y === N - 1); }
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
    const e = this.inb(x, y) && this.edgeOpen(x, y), off = (xx, yy) => e && !this.inb(xx, yy);
    return (this.isRoad(x, y - 1) || off(x, y - 1) ? 1 : 0) | (this.isRoad(x + 1, y) || off(x + 1, y) ? 2 : 0) | (this.isRoad(x, y + 1) || off(x, y + 1) ? 4 : 0) | (this.isRoad(x - 1, y) || off(x - 1, y) ? 8 : 0);
  }
  toJSON() {
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
    return { n: N, seed: this.seed, map: this.map, terrain: b64(this.terrain), tree: b64(this.tree), kind: b64(this.kind), level: b64(this.level), variant: b64(this.variant), bt: b64(this.bt), bo: b64(this.bo), wire: b64(this.wire), pipe: b64(this.pipe), hw: b64(this.hw), wear: b64(this.wear), fix: b64(this.fix) };
  }
  static fromJSON(o) {
    const on = o.n || 64, w = new World(o.seed), off = (N - on) >> 1;
    w.map = o.map || 'classic';
    for (let i = 0; i < N * N; i++) if (w.hw[i]) w.kind[i] = T.EMPTY;   // drop the fresh map's highway first
    w.hw.fill(0);
    w.migrated = on !== N;          // a smaller city from an older version is placed in the middle of the bigger map
    const un = (str, arr) => {
      const b = atob(str);
      if (!w.migrated) { for (let i = 0; i < arr.length && i < b.length; i++) arr[i] = b.charCodeAt(i); return; }
      for (let y = 0; y < on; y++) for (let x = 0; x < on; x++) arr[(y + off) * N + x + off] = b.charCodeAt(y * on + x);
    };
    un(o.terrain, w.terrain); un(o.tree, w.tree); un(o.kind, w.kind); un(o.level, w.level); un(o.variant, w.variant);
    if (o.bt) { un(o.bt, w.bt); un(o.bo, w.bo); }
    if (o.wire) un(o.wire, w.wire);
    if (o.pipe) un(o.pipe, w.pipe);
    if (o.wear) un(o.wear, w.wear);
    if (o.fix) un(o.fix, w.fix);
    if (o.hw && !w.migrated) un(o.hw, w.hw);
    else w.ensureHighway();                          // older save: route a highway to the existing roads
    w.derive();
    return w;
  }
}
export { clamp };
