// Small life (0.8.0): people hanging out at parks, plazas, piers, beaches, marinas, the stadium, the museum, libraries
// and pack buildings like the cafe, and people (and the odd car) on the dirt tracks behind the houses.
// Nothing here changes the game; it only fills the scene. The renderer draws these with the other people and cars, in
// painter order, so buildings in front still cover them. Skipped on Smooth graphics.
import { N, T, TERRAIN } from './world.js';
import { BT, shoreXY } from './buildings.js';
import { hash } from './util.js';

// How many people each kind of place draws at its busiest, and where they go.
// 'front': along the two front sides of the footprint (the sides facing the camera), so the building never covers them
// wrongly. 'all': anywhere on the lot (open places with nothing tall). 'deck': out along a pier. 'beach': on the sand
// and swimming in front of it.
const PLACES = {
  plaza: [7, 'all'], library: [3, 'front'], museum: [5, 'front'], stadium: [12, 'front'],
  pier: [4, 'deck'], beach: [9, 'beach'], marina: [5, 'deck'],
};
const PARK = [3, 'park'];

export class Life {
  constructor(game) { this.g = game; this.people = []; this.spots = []; this.scanT = -99; this.walkers = []; this.pathT = 0; this.ver = -1; }
  get list() { return this.people; }
  // dt in seconds of real time; called every frame
  update(dt) {
    const g = this.g, now = performance.now() / 1000;
    if (g.fast || !g.sim) { this.people.length = 0; this.walkers.length = 0; return; }
    if (now - this.scanT > 4) { this.scanT = now; this.scan(); }
    const ph = (g.clock / 180) % 1, night = g.mode === 2, dusk = g.mode === 1;
    const rain = g.ambient ? g.ambient.weather.k : 0, winter = g.sim.SEASON_NOW === 3, summer = g.sim.SEASON_NOW === 1;
    const popK = Math.min(1, (g.sim.pop || 0) / 250 + 0.25);
    // hangouts: keep each place near its target, one person added or removed at a time
    for (const s of this.spots) {
      let k = night ? 0.2 : dusk ? 0.65 : 1;
      if (s.key === 'stadium' && (night || dusk)) k = 1;                            // evening games
      if (s.key === 'beach') k *= winter ? 0.08 : summer ? 1.3 : 0.6;
      else if (s.mode === 'deck' || s.mode === 'park' || s.key === 'plaza') k *= winter ? 0.5 : 1;
      k *= 1 - Math.min(0.75, rain);
      s.want = Math.round(s.max * k * popK);
      if (s.have < s.want && hash(s.i, Math.floor(now * 2), 7) < 0.25) this.add(s);
      else if (s.have > s.want && hash(s.i, Math.floor(now * 2), 8) < 0.15) this.remove(s);
    }
    for (const p of this.people) if (!p.track) this.move(p, dt, now);
    this.tracks(dt, now, night, rain, popK);
  }
  // Every few seconds: which places are there, and are the people still standing somewhere real?
  scan() {
    const g = this.g, w = g.world, old = new Map(this.spots.map((s) => [s.i, s])), spots = [];
    for (let i = 0; i < N * N; i++) {
      const k = w.kind[i];
      if (k === T.PARK && !g.sites.has(i)) { spots.push(old.get(i) || { i, key: 'park', ax: i % N, ay: (i / N) | 0, w: 1, d: 1, max: PARK[0] + (hash(i, 1, 3) < 0.4 ? 1 : 0), mode: PARK[1], have: 0, face: 0 }); continue; }
      if (k !== T.SVC || w.bo[i] !== 0 || g.sites.has(i)) continue;
      const def = BT[w.bt[i]]; if (!def) continue;
      const pl = PLACES[def.key] || (def.cat === 'fun' ? [3, 'front'] : null);                 // content-pack fun places (the cafe) too
      if (!pl || g.sim.closed(def)) continue;
      spots.push(old.get(i) || { i, key: def.key, ax: i % N, ay: (i / N) | 0, w: def.w, d: def.d, max: pl[0], mode: pl[1], have: 0, face: def.reach ? w.variant[i] & 3 : 0, reach: def.reach || 0 });
    }
    const keep = new Set(spots.map((s) => s.i));
    this.people = this.people.filter((p) => p.track || keep.has(p.spot.i));
    for (const s of spots) s.have = this.people.filter((p) => p.spot === s).length;
    this.spots = spots;
  }
  // a spot for someone at this place: [x, y, swimming]
  where(s, r1, r2) {
    const { ax, ay } = s;
    if (s.mode === 'park') return Math.floor(r1 * 2) ? [ax + 0.5 + (r2 - 0.5) * 0.12, ay + 0.15 + r2 * 0.7] : [ax + 0.15 + r2 * 0.7, ay + 0.5 + (r1 - 0.5) * 0.12];   // on the paths
    if (s.mode === 'all') return [ax + 0.15 + r1 * (s.w - 0.3), ay + 0.15 + r2 * (s.d - 0.3)];
    if (s.mode === 'front') return r1 < 0.5 ? [ax + 0.12 + r2 * (s.w - 0.24), ay + s.d - 0.1] : [ax + s.w - 0.1, ay + 0.12 + r2 * (s.d - 0.24)];
    if (s.mode === 'deck' && s.face >= 2) return r1 < 0.5 ? [ax + 0.12 + r2 * (s.w - 0.24), ay + s.d - 0.1] : [ax + s.w - 0.1, ay + 0.12 + r2 * (s.d - 0.24)];   // a deck facing away from the camera would hide them: they stand at the land end
    if (s.mode === 'deck') { const [X, Y] = shoreXY(s.face, s.w, 0.15 + r1 * (s.reach - 0.3), s.w / 2 + (r2 - 0.5) * 0.3); return [ax + X, ay + Y]; }
    // beach: most on the sand, some swimming just off it
    if (r1 < 0.68) { const [X, Y] = shoreXY(s.face, s.w, -0.2 - r2 * (s.w - 0.5), 0.2 + hash(s.i, Math.floor(r1 * 100), 5) * (s.w - 0.4)); return [ax + X, ay + Y]; }
    const [X, Y] = shoreXY(s.face, s.w, 0.25 + r2 * 0.8, 0.2 + hash(s.i, Math.floor(r1 * 100), 6) * (s.w - 0.4)); return [ax + X, ay + Y, true];
  }
  add(s) {
    const n = this.people.length, r1 = Math.random(), r2 = Math.random(), [x, y, swim] = this.where(s, r1, r2);
    const w = this.g.world; if (swim && w.terrain[Math.max(0, Math.min(N - 1, Math.floor(y))) * N + Math.max(0, Math.min(N - 1, Math.floor(x)))] !== TERRAIN.WATER) return;
    const idle = swim || Math.random() < 0.55;                       // about half stand around and chat, half stroll
    this.people.push({ ped: true, spot: s, px: x, py: y, hx: x, hy: y, dx: 0, dy: 1, col: (n * 7 + s.i) % 8, idle, still: idle, swim: !!swim, t: Math.random() * 10, alpha: 0 });
    s.have++;
  }
  remove(s) { const k = this.people.findIndex((p) => p.spot === s && !p.leaving); if (k >= 0) { this.people[k].leaving = true; s.have--; } }
  move(p, dt, now) {
    p.alpha = p.leaving ? p.alpha - dt * 1.5 : Math.min(1, p.alpha + dt * 1.5);
    if (p.leaving && p.alpha <= 0) { const k = this.people.indexOf(p); if (k >= 0) this.people.splice(k, 1); return; }
    if (p.swim) { p.px = p.hx + Math.sin(now * 0.6 + p.col) * 0.05; p.py = p.hy + Math.cos(now * 0.5 + p.col) * 0.05; return; }
    if (p.idle) { if (Math.random() < dt * 0.04) { p.idle = false; p.still = false; p.go = null; } return; }     // now and then they set off
    if (!p.go) { const [x, y] = this.where(p.spot, Math.random(), Math.random()); p.go = [x, y]; }
    const ex = p.go[0] - p.px, ey = p.go[1] - p.py, L = Math.hypot(ex, ey), sp = 0.22 * dt;
    if (L < sp) { p.px = p.go[0]; p.py = p.go[1]; p.go = null; if (Math.random() < 0.5) { p.idle = true; p.still = true; } return; }
    p.px += (ex / L) * sp; p.py += (ey / L) * sp;
    if (Math.abs(ex) > Math.abs(ey)) { p.dx = Math.sign(ex); p.dy = 0; } else { p.dx = 0; p.dy = Math.sign(ey); }
  }
  // People walking the dirt tracks between the houses and the street, and now and then a car.
  tracks(dt, now, night, rain, popK) {
    const paths = this.g.sim.trackPaths || [], M = N + 1;
    const want = Math.min(14, Math.round(paths.length * 0.25 * popK * (night ? 0.3 : 1) * (1 - Math.min(0.7, rain))));
    let have = 0; for (const p of this.people) if (p.track) have++;
    this.pathT += dt;
    if (have < want && paths.length && this.pathT > 0.6) {
      this.pathT = 0;
      const P = paths[Math.floor(Math.random() * paths.length)], out = Math.random() < 0.5;
      const pts = P.pts.map((c) => [(c % M) - 0.11, ((c / M) | 0) - 0.11]); if (!out) pts.reverse();     // along the lane's middle
      const car = !night && Math.random() < 0.12;
      this.people.push({ track: true, ped: !car, pts, k: 0, u: 0, px: pts[0][0], py: pts[0][1], dx: 0, dy: 1, col: Math.floor(Math.random() * 8), speed: car ? 0.55 : 0.28, alpha: 0 });
    }
    for (let j = this.people.length - 1; j >= 0; j--) {
      const p = this.people[j]; if (!p.track) continue;
      const A = p.pts[p.k], B = p.pts[p.k + 1];
      if (!B) { p.alpha -= dt * 2; if (p.alpha <= 0) this.people.splice(j, 1); continue; }
      p.alpha = Math.min(1, p.alpha + dt * 2);
      p.u += (p.speed * dt) / Math.max(0.01, Math.hypot(B[0] - A[0], B[1] - A[1]));
      if (p.u >= 1) { p.u = 0; p.k++; continue; }
      p.px = A[0] + (B[0] - A[0]) * p.u; p.py = A[1] + (B[1] - A[1]) * p.u;
      p.dx = Math.sign(B[0] - A[0]); p.dy = Math.sign(B[1] - A[1]);
    }
  }
}
