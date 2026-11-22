// Harbor ships. Every harbor (an industry lot by a lake or the sea) has ships coming and going, more as it grows.
// Water that reaches the map edge is the open sea: cargo ships sail in from the edge, dock at the harbor for a while
// and sail back out. On inland water (or when a bridge cuts a harbor off from the sea) barges shuttle between the
// harbors on that water, or out across the lake and back when there is only one. Ships never pass under bridges.
// Routes come from distance fields over the water (one per destination), made once and cached until a bridge changes.
import { N, T, TERRAIN } from './world.js';
import { BT, FACE_OUT, berthTile } from './buildings.js';

const SEA_SHIPS = [0, 1, 1, 2, 3];     // cargo ships per sea harbor, by harbor level
const BARGES = [0, 1, 1, 1, 2];        // barges per inland harbor, by harbor level
const MAX_SHIPS = 14;                   // a ceiling for the whole map, for slow phones
const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

export class Ships {
  constructor(world, rnd) {
    this.w = world; this.rnd = rnd; this.list = []; this.harbors = new Map(); this.fields = new Map();
    this.sig = -1; this.checkT = 99; this.nav = new Uint8Array(N * N); this.comp = new Int32Array(N * N);
    this.hd = new Float32Array(N * N * 8 + 8); this.hi = new Int32Array(N * N * 8 + 8);   // one heap, reused, so routes make no garbage
  }
  // ---- water map: open water (no bridge), its connected parts, and which parts reach the map edge ----
  rebuild(sim) {
    const w = this.w, n = N * N, nav = this.nav, comp = this.comp, deck = sim ? sim.decks() : null; comp.fill(-1);
    for (let i = 0; i < n; i++) nav[i] = w.terrain[i] === TERRAIN.WATER && w.kind[i] !== T.ROAD && !(deck && deck[i] === 1) ? 1 : 0;   // nothing sails under piers and pontoons
    this.compSize = []; this.compEdge = []; this.edgeTiles = [];
    const st = [];
    for (let s = 0; s < n; s++) {
      if (!nav[s] || comp[s] >= 0) continue;
      const id = this.compSize.length; let size = 0; const edges = [];
      comp[s] = id; st.push(s);
      while (st.length) {
        const c = st.pop(), x = c % N, y = (c / N) | 0; size++;
        if (x === 0 || y === 0 || x === N - 1 || y === N - 1) edges.push(c);
        for (const [dx, dy] of D8.slice(0, 4)) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const q = yy * N + xx; if (nav[q] && comp[q] < 0) { comp[q] = id; st.push(q); } }
      }
      this.compSize.push(size); this.compEdge.push(edges.length > 0); this.edgeTiles.push(edges);
    }
    // tiles next to land cost more, so ships keep to open water where they can
    this.cost = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (!nav[i]) continue; const x = i % N, y = (i / N) | 0; let near = false;
      for (let j = -1; j <= 1 && !near; j++) for (let k = -1; k <= 1; k++) { const xx = x + k, yy = y + j; if (xx >= 0 && yy >= 0 && xx < N && yy < N && !nav[yy * N + xx]) { near = true; break; } }
      this.cost[i] = near ? 2.5 : 1;
    }
    this.fields.clear(); this.gen = (this.gen || 0) + 1;
  }
  bridgeSig() {                                      // changes when a bridge, pier, beach or marina is built or removed
    const w = this.w; let h = 7;
    for (let i = 0; i < N * N; i++) if ((w.kind[i] === T.ROAD && w.terrain[i] === TERRAIN.WATER) || (w.kind[i] === T.SVC && w.bo[i] === 0 && BT[w.bt[i]].reach)) h = (h * 31 + i + 1 + w.variant[i] * 7919) >>> 0;
    return h;
  }
  // Distance (in travel cost) from every open-water tile to the nearest seed. No corner cutting past land.
  field(key, seeds) {
    let f = this.fields.get(key); if (f) return f;
    if (this.fb <= 0) return null;                    // at most one new route per frame, so a frame never stalls
    this.fb--;
    const n = N * N, nav = this.nav, cost = this.cost; f = new Float32Array(n).fill(Infinity);
    const hd = this.hd, hi = this.hi; let len = 0;
    const push = (d, i) => { let k = len++; while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= d) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; } hd[k] = d; hi[k] = i; };
    for (const s of seeds) if (nav[s]) { f[s] = 0; push(0, s); }
    while (len) {
      const d = hd[0], c = hi[0]; len--;
      if (len) { const ld = hd[len], li = hi[len]; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; if (l >= len) break; const m = r < len && hd[r] < hd[l] ? r : l; if (hd[m] >= ld) break; hd[k] = hd[m]; hi[k] = hi[m]; k = m; } hd[k] = ld; hi[k] = li; }
      if (d > f[c]) continue;
      const x = c % N, y = (c / N) | 0;
      for (const [dx, dy, m] of D8) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const q = yy * N + xx; if (!nav[q]) continue;
        if (dx && dy && (!nav[y * N + xx] || !nav[yy * N + x])) continue;
        const nd = d + m * cost[q]; if (nd < f[q]) { f[q] = nd; push(nd, q); }
      }
    }
    if (this.fields.size > 40) this.fields.delete(this.fields.keys().next().value);
    this.fields.set(key, f); return f;
  }
  toTile(t) { return this.field('t' + t, [t]); }
  toEdge(c) { return this.field('e' + c, this.edgeTiles[c]); }

  // ---- harbors: find them, pick each one's berth, and decide how many ships it should have ----
  scan(sim) {
    const w = this.w, sig = this.bridgeSig();
    if (sig !== this.sig) { this.sig = sig; this.rebuild(sim); for (const h of this.harbors.values()) h.dead = true; }
    const seen = new Set();
    for (let i = 0; i < N * N; i++) {
      if (w.kind[i] === T.SVC && w.bo[i] === 0) {           // marinas and ferry piers have their own boats
        const def = BT[w.bt[i]]; if (def.key !== 'marina' && !def.ferry) continue;
        if (sim.pending.has(i) || sim.closed(def)) continue;
        let h = this.harbors.get(i);
        if (!h || h.dead) {
          const face = w.variant[i], [bx, by] = berthTile(def, i % N, (i / N) | 0, face); if (bx < 0 || by < 0 || bx >= N || by >= N) continue;
          const q = by * N + bx; if (!this.nav[q]) continue;
          h = { i, type: def.ferry ? 'ferry' : 'marina', dock: q, comp: this.comp[q], sea: false, qx: -FACE_OUT[face][0], qy: -FACE_OUT[face][1], cool: 1 + this.rnd() * 4 }; this.harbors.set(i, h);
        }
        h.lvl = 1; seen.add(i); continue;
      }
      if (w.kind[i] !== T.IND || w.shore[i] < 2) continue;
      const l = sim.lvl(i); if (!l) continue;
      let h = this.harbors.get(i);
      if (!h || h.dead) {
        const b = this.berth(i, sim.seaLink[i] === 1); if (!b) continue;
        h = { i, type: 'harbor', ...b, cool: 1 + this.rnd() * 4 }; this.harbors.set(i, h);
      }
      h.lvl = l; seen.add(i);
    }
    for (const [i, h] of this.harbors) if (!seen.has(i) || h.dead) { this.harbors.delete(i); h.gone = true; }
    for (const s of this.list) if (!this.harbors.has(s.h) || this.harbors.get(s.h) !== s.hb) s.orphan = true;
    const routes = new Map();                             // ferry piers on each stretch of water, in a fixed order
    for (const h of this.harbors.values()) if (h.type === 'ferry') (routes.get(h.comp) || routes.set(h.comp, []).get(h.comp)).push(h);
    for (const r of routes.values()) r.sort((a, b) => a.i - b.i);
    for (const h of this.harbors.values()) {
      if (h.type === 'ferry') { const r = routes.get(h.comp); h.route = r; const at = r.indexOf(h); h.want = r.length >= 2 && (at === 0 || (at === 2 && r.length >= 4)) ? 1 : 0; }
      else h.want = h.type === 'marina' ? 2 : (h.sea ? SEA_SHIPS : BARGES)[h.lvl];
      const mine = this.list.filter((s) => s.hb === h && !s.orphan); h.active = mine.length;
      if (mine.length > h.want) mine[mine.length - 1].orphan = true;      // the harbor shrank: one ship fewer
    }
  }
  // The water tile a harbor's ships tie up at: the nearest open water within 2 tiles, on water big enough to be a lake.
  berth(i, wantSea) {
    const x = i % N, y = (i / N) | 0; let best = null;
    for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
      const xx = x + k, yy = y + j; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const q = yy * N + xx; if (!this.nav[q]) continue;
      const c = this.comp[q], sea = this.compEdge[c]; if (!sea && this.compSize[c] < 16) continue;
      const score = Math.hypot(k, j) + (this.cost[q] > 1 ? 0 : -0.3) + (wantSea && !sea ? 10 : 0);
      if (!best || score < best.score) best = { score, q, c, sea, qx: -k, qy: -j };
    }
    if (!best) return null;
    const ql = Math.hypot(best.qx, best.qy) || 1;
    return { dock: best.q, comp: best.c, sea: best.sea, qx: best.qx / ql, qy: best.qy / ql };
  }
  // Where a barge goes: another harbor on the same water (taking turns), or out to the far side of the lake.
  destination(h, s) {
    const all = [...this.harbors.values()];
    if (h.type === 'harbor') {
      const others = all.filter((o) => o !== h && o.type === 'harbor' && !o.sea && o.comp === h.comp);
      if (others.length) { const o = others[(s.trip++) % others.length]; return o.dock; }
      const m = all.find((o) => o.type === 'marina' && o.comp === h.comp); if (m) return m.dock;     // or the marina, if the lake has one
    }
    if (h.far == null) {
      const f = this.toTile(h.dock); if (!f) return null; let best = -1, far = h.dock;
      const lim = h.type === 'marina' ? 14 : 40;           // yachts take a short sail; barges cross the lake
      for (let q = 0; q < N * N; q++) if (this.comp[q] === h.comp && this.cost[q] === 1 && f[q] <= lim && f[q] > best) { best = f[q]; far = q; }
      h.far = far;
    }
    return h.far;
  }
  spawn(h) {
    const r = this.rnd, s = { hb: h, h: h.i, kind: h.type === 'ferry' ? 'ferry' : h.type === 'marina' ? 'yacht' : h.sea ? 'cargo' : 'barge', qx: h.qx, qy: h.qy, leg: h.route ? h.route.indexOf(h) : 0, fade: 0, a: 0, sp: 0, moving: false, col: Math.floor(r() * 5), size: h.lvl, trip: Math.floor(r() * 4), load: r() < 0.8 };
    if (h.sea) {
      const edges = this.edgeTiles[h.comp]; if (!edges.length) return false;
      const f = this.toTile(h.dock); if (!f) return false;
      const near = edges.filter((q) => f[q] < Infinity).sort((p, q) => f[p] - f[q]);   // come in from the nearer stretch of sea
      if (!near.length) return false;
      const e = near[Math.floor(r() * Math.max(1, Math.ceil(near.length / 3)))], ex = e % N, ey = (e / N) | 0;
      const ox = ex === 0 ? -1 : ex === N - 1 ? 1 : 0, oy = ey === 0 ? -1 : ey === N - 1 ? 1 : 0;
      Object.assign(s, { x: ex + 0.5 + ox * 1.5, y: ey + 0.5 + oy * 1.5, a: Math.atan2(-oy, -ox), state: 'in', goal: h.dock, sp: 0.55 + r() * 0.15 });
    } else {
      const dx = h.dock % N, dy = (h.dock / N) | 0;
      Object.assign(s, { x: dx + 0.5, y: dy + 0.5, a: Math.atan2(h.qx, -h.qy), state: 'dock', wait: 4 + r() * 8, sp: s.kind === 'ferry' ? 0.45 : s.kind === 'yacht' ? 0.3 + r() * 0.08 : 0.22 + r() * 0.06 });
    }
    h.active++; this.list.push(s); return true;
  }
  update(dt, sim) {
    if (dt <= 0) return;
    this.fb = 1; this.checkT += dt;
    if (this.checkT > 3) {
      this.checkT = 0; this.scan(sim); let made = 0;
      for (const h of this.harbors.values()) {
        h.cool -= 3;
        if (made < 2 && h.active < h.want && h.cool <= 0 && this.list.length < MAX_SHIPS && this.spawn(h)) { made++; h.cool = 8 + this.rnd() * 16; }
      }
    }
    for (let k = this.list.length - 1; k >= 0; k--) {
      const s = this.list[k], h = s.hb;
      if (s.fadeOut) { s.fade -= dt * 0.5; if (s.fade <= 0) this.list.splice(k, 1); if (s.state === 'exit') this.move(s, s.a, s.sp, dt); continue; }
      s.fade = Math.min(1, s.fade + dt * 0.5);
      if (s.orphan && s.state !== 'out' && s.state !== 'exit') {      // its harbor is gone or smaller: a ship sails away, a barge fades
        const c = this.comp[Math.max(0, Math.min(N - 1, Math.floor(s.y))) * N + Math.max(0, Math.min(N - 1, Math.floor(s.x)))];
        if (s.kind === 'cargo' && c >= 0 && this.compEdge[c]) { s.state = 'out'; s.ec = c; } else { s.fadeOut = true; continue; }
      }
      if (s.state === 'dock' || s.state === 'dock2') {
        s.moving = false; s.wait -= dt;
        const pa = Math.atan2(s.qx, -s.qy), pb = pa + Math.PI, da = angDiff(pa, s.a), db = angDiff(pb, s.a);   // lie along the quay
        if (s.state === 'dock') s.a += clampA(Math.abs(da) < Math.abs(db) ? da : db, 0.5 * dt);
        if (s.wait > 0) continue;
        if (s.kind === 'ferry') {                          // on to the next pier on the route
          const r = h.route || []; if (r.length < 2) { s.fadeOut = true; continue; }
          s.leg = (s.leg + 1) % r.length; const to = r[s.leg]; s.state = 'go'; s.goal = to.dock; s.to = to; continue;
        }
        if (h.sea) { s.state = 'out'; s.ec = h.comp; s.load = this.rnd() < 0.7; }
        else if (s.state === 'dock') { const goal = this.destination(h, s); if (goal == null) { s.wait = 0.5; continue; } s.state = 'go'; s.goal = goal; s.load = !s.load; }
        else { s.state = 'back'; s.goal = h.dock; }
        continue;
      }
      const fk = s.state === 'out' ? -1 - s.ec : s.goal;             // the ship keeps its route until the water changes
      if (s.fk !== fk || s.fg !== this.gen || !s.f) { s.f = s.state === 'out' ? this.toEdge(s.ec) : this.toTile(s.goal); s.fk = fk; s.fg = this.gen; }
      const f = s.f;
      if (!f) continue;                                  // its route is made next frame
      const r = this.steer(s, f, dt);
      if (r === 'stuck') { s.fadeOut = true; continue; }
      if (r === 'arrived') {
        if (s.state === 'out') { s.state = 'exit'; s.fadeOut = true; const ex = Math.floor(s.x), ey = Math.floor(s.y); s.a = Math.atan2(ey <= 0 ? -1 : ey >= N - 1 ? 1 : 0, ex <= 0 ? -1 : ex >= N - 1 ? 1 : 0); }
        else if (s.state === 'in' || s.state === 'back') { s.state = 'dock'; s.wait = h.sea ? 25 + this.rnd() * 25 : 12 + this.rnd() * 14; }
        else if (s.state === 'go' && s.kind === 'ferry') { s.state = 'dock'; s.wait = 8 + this.rnd() * 5; if (s.to) { s.qx = s.to.qx; s.qy = s.to.qy; } }
        else if (s.state === 'go') { s.state = 'dock2'; s.wait = 8 + this.rnd() * 10; }
      }
    }
  }
  // The neighbouring tile one step closer to the goal (-1 if none). No corner cutting past land.
  next(f, t) {
    const x = t % N, y = (t / N) | 0, nav = this.nav; let b = -1, bv = f[t];
    for (let j = 0; j < 8; j++) {
      const dx = D8[j][0], dy = D8[j][1], xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const q = yy * N + xx; if (f[q] < bv && (!dx || !dy || (nav[y * N + xx] && nav[yy * N + x]))) { bv = f[q]; b = q; }
    }
    return b;
  }
  move(s, a, sp, dt) { s.x += Math.cos(a) * sp * dt; s.y += Math.sin(a) * sp * dt; }
  wet(x, y) { const xx = Math.floor(x), yy = Math.floor(y); return xx < 0 || yy < 0 || xx >= N || yy >= N || this.w.terrain[yy * N + xx] === TERRAIN.WATER; }
  clearLine(x0, y0, x1, y1) { for (let k = 1; k <= 4; k++) { const u = k / 4; if (!this.wet(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u)) return false; } return true; }
  // Follow the distance field downhill, aiming two tiles ahead so the turns are smooth.
  steer(s, f, dt) {
    const tx0 = Math.max(0, Math.min(N - 1, Math.floor(s.x))), ty0 = Math.max(0, Math.min(N - 1, Math.floor(s.y))), c = ty0 * N + tx0;
    const next = (t) => this.next(f, t);
    let aim;
    if (s.bump > 0 && this.nav[c] && f[c] > 0) { s.bump -= dt; aim = c; }      // just bumped a corner of land: back to the middle of the tile first
    else if (f[c] === Infinity) { const b = next(c); if (b < 0) return 'stuck'; aim = b; }
    else if (f[c] === 0) aim = c;
    else { const b = next(c); if (b < 0) return 'stuck'; const b2 = next(b); aim = b2 >= 0 && f[b] > 0 && this.clearLine(s.x, s.y, (b2 % N) + 0.5, ((b2 / N) | 0) + 0.5) ? b2 : b; }
    let ax = (aim % N) + 0.5, ay = ((aim / N) | 0) + 0.5;
    const h = s.hb, atGoal = f[aim] === 0;
    if (atGoal && s.state !== 'out' && s.state !== 'go') { ax += h.qx * 0.2; ay += h.qy * 0.2; }   // tie up close to the quay
    const dx = ax - s.x, dy = ay - s.y, dist = Math.hypot(dx, dy);
    s.near = atGoal ? (s.near || 0) + dt : 0;
    if (atGoal && (dist < (s.state === 'out' ? 0.6 : 0.15) || s.near > 8)) { s.moving = false; s.near = 0; return 'arrived'; }
    const want = Math.atan2(dy, dx), d = angDiff(want, s.a);
    s.a += clampA(d, 1.1 * dt);
    let sp = s.sp * Math.max(0.2, Math.cos(d));
    if (atGoal && s.state !== 'out') sp *= Math.max(0.2, Math.min(1, dist / 1.2));    // ease in to the berth
    const nx = s.x + Math.cos(s.a) * sp * dt, ny = s.y + Math.sin(s.a) * sp * dt;
    if (!this.wet(nx, ny)) { s.moving = false; s.bump = 0.8; return null; }             // never run aground: turn on the spot instead
    s.x = nx; s.y = ny; s.moving = sp > 0.08;
    return null;
  }
}
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const clampA = (d, m) => Math.max(-m, Math.min(m, d));
