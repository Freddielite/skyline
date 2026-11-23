// The metro network (0.8.12). Stations are linked by tunnels the player lays (tap one station, then another); any station
// can have several links, so links form lines, branches, loops and interchanges. A commute by metro is: walk to a station,
// wait, ride through the network (changing at interchanges if it must), get off and go the last bit to work. It is
// compared with going by road, and people take whichever is quicker. Before 0.8.12 a station just gave homes within 14
// tiles 22 extra road tiles of commute, whether or not a station stood anywhere near the jobs.
import { N, T } from './world.js';
import { BT } from './buildings.js';
import { POP_CAP } from './sim.js';   // used only inside functions, so the circular import is fine

export const TUNNEL = 40;            // $ per tile of tunnel
export const TUNNEL_UPKEEP = 0.5;    // $ per tile a month
export const WALK_R = 10;            // tiles people walk to a station
export const RIDE = 0.25;            // travel cost per tile underground (a street tile costs about 1)
export const STOP = 0.6;             // each station passed
export const CHANGE = 1.5;           // passing through an interchange (a station with three or more links): changing lines
export const BOARD = 3;              // walking down and waiting for a train
export const WALK = 1.5;             // walking cost per tile to the station
const EGRESS = 12;                   // the most road travel from the exit station to work (or home) that still counts
export const LINE_COLS = ['#e0483f', '#3a7bd5', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#c2185b'];
const NAMES = ['Central', 'Market', 'Harbour', 'Riverside', 'Park Lane', 'Northgate', 'Hillside', 'Old Town', 'Mill Road', 'Kingsway',
  'Elm Grove', 'Westgate', 'Eastgate', 'Station Road', 'Bridge Street', 'Garden City', 'Southfield', 'Victoria', 'Canal Street', 'High Street',
  'Oak Avenue', 'Meadow Lane', 'Church Street', 'Granary', 'Foundry', 'Lakeside', 'Cedar Park', 'Union Square', 'Broadway', 'Orchard'];

const key = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
export const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

// Stations, their links and which network each belongs to. Called from sim.anCoverage with the day's anchors.
export function buildMetro(sim, anchors) {
  const w = sim.w, st = anchors.filter((a) => a.def.metro).map((a) => ({ i: a.i, x: a.x, y: a.y, cx: a.x + 0.5, cy: a.y + 0.5, on: !sim.closed(a.def) && !!sim.pw[a.i], links: [], comp: -1, name: '', board: 0, alight: 0 }));
  const by = new Map(st.map((s) => [s.i, s]));
  // older cities: lay tunnels between their stations once, nearest first, so every station that worked before still does
  if (!Array.isArray(sim.metroLinks)) {
    sim.metroLinks = [];
    if (st.length >= 2) {
      const inT = new Set([st[0].i]);
      while (inT.size < st.length) {
        let best = null, bd = 1e9;
        for (const a of st) if (inT.has(a.i)) for (const b of st) if (!inT.has(b.i)) { const d = dist(a, b); if (d < bd) { bd = d; best = [a.i, b.i]; } }
        sim.metroLinks.push(best); inT.add(best[1]);
      }
    }
  }
  sim.metroLinks = sim.metroLinks.filter(([a, b]) => by.has(a) && by.has(b) && a !== b);
  // names: kept per station; a new station takes the first free one
  const names = sim.metroNames || (sim.metroNames = {}), used = new Set();
  for (const k of Object.keys(names)) if (!by.has(+k)) delete names[k]; else used.add(names[k]);
  for (const s of st) {
    if (!names[s.i]) { const free = NAMES.find((n) => !used.has(n)) || `Station ${Object.keys(names).length + 1}`; names[s.i] = free; used.add(free); }
    s.name = names[s.i];
  }
  const edges = [];
  for (const [a, b] of sim.metroLinks) { const A = by.get(a), B = by.get(b), len = dist(A, B); edges.push({ a, b, len }); A.links.push({ to: b, len }); B.links.push({ to: a, len }); }
  // networks (connected parts), largest first, each with its own colour
  let nc = 0; const sizes = [];
  for (const s of st) {
    if (s.comp >= 0) continue;
    const stack = [s]; s.comp = nc; let size = 0;
    while (stack.length) { const c = stack.pop(); size++; for (const l of c.links) { const o = by.get(l.to); if (o.comp < 0) { o.comp = nc; stack.push(o); } } }
    sizes.push(size); nc++;
  }
  const order = sizes.map((n, k) => [n, k]).sort((p, q) => q[0] - p[0]).map((p) => p[1]), rank = new Map(order.map((k, r) => [k, r]));
  for (const s of st) s.comp = rank.get(s.comp);
  const compSize = order.map((k) => sizes[k]);
  // tunnel tiles (ventilation grates on the streets above, and the Metro view)
  const tun = w.tun || (w.tun = new Uint8Array(N * N)); tun.fill(0);
  let tiles = 0;
  for (const e of edges) { const A = by.get(e.a), B = by.get(e.b), n = Math.max(1, Math.ceil(e.len * 2)); for (let k = 0; k <= n; k++) { const x = Math.floor(A.cx + (B.cx - A.cx) * k / n), y = Math.floor(A.cy + (B.cy - A.cy) * k / n); tun[y * N + x] = 1; } tiles += e.len; }
  const old = sim.metroNet;
  if (old) for (const s2 of st) { const o = old.by.get(s2.i); if (o) { s2.board = o.board; s2.alight = o.alight; } }   // riders are counted with the commutes, which run less often
  sim.metroNet = { st, by, edges, compSize, tiles, ver: (old ? old.ver : 0) + (old && old.sig === sim.metroLinks.map((l) => key(...l)).join() + st.map((s) => s.i + (s.on ? 'a' : 'b')).join() ? 0 : 1) };
  sim.metroNet.sig = sim.metroLinks.map((l) => key(...l)).join() + st.map((s) => s.i + (s.on ? 'a' : 'b')).join();
  return sim.metroNet;
}
// a station serves when it is open, has power and is linked to at least one other open station
export function serving(s) { return s.on && s.links.length > 0; }

// From each station, the quickest way through the network to the nearest place the commute ends: `end[s]` is the road
// travel from station s to the nearest job (or home), or Infinity. Returns per station: cost (ride plus that last bit),
// the exit station and the number of stops. Dijkstra over the stations (there are only ever a few dozen).
export function networkTo(net, end) {
  const st = net.st, n = st.length, cost = new Float64Array(n).fill(Infinity), exit = new Int32Array(n).fill(-1), stops = new Int32Array(n), idx = new Map(st.map((s, k) => [s.i, k])), done = new Uint8Array(n);
  for (let k = 0; k < n; k++) if (serving(st[k]) && end[k] <= EGRESS) { cost[k] = end[k]; exit[k] = k; }
  for (;;) {
    let u = -1, bu = Infinity; for (let k = 0; k < n; k++) if (!done[k] && cost[k] < bu) { bu = cost[k]; u = k; }
    if (u < 0) break; done[u] = 1;
    const su = st[u], pass = (exit[u] !== u ? STOP + (su.links.length >= 3 ? CHANGE : 0) : 0);
    for (const l of su.links) {
      const v = idx.get(l.to); if (done[v] || !serving(st[v])) continue;
      const c = cost[u] + l.len * RIDE + pass;
      if (c < cost[v]) { cost[v] = c; exit[v] = exit[u]; stops[v] = stops[u] + 1; }
    }
  }
  return { cost, exit, stops, idx };
}

// The commute by metro for every home (to jobs) and every workplace (from homes), next to the commute by road. Called
// from sim.analyzeRoads with its road distances. Fills sim.metroRide (homes that go by metro), sim.metroVia (board and
// exit station per tile) and each station's riders, and returns per tile the metro cost (or Infinity).
export function metroCommutes(sim, zones, jobD, homeD, roadsNear) {
  const net = sim.metroNet, n = N * N, w = sim.w;
  sim.metroRide.fill(0); sim.metroVia.fill(-1);
  const out = new Float32Array(n).fill(Infinity);
  if (!net || !net.st.some(serving)) return out;
  const st = net.st, endJ = st.map((s) => { let b = Infinity; for (const q of roadsNear(s.x, s.y)) if (jobD[q] < b) b = jobD[q]; return b; });
  const endH = st.map((s) => { let b = Infinity; for (const q of roadsNear(s.x, s.y)) if (homeD[q] < b) b = homeD[q]; return b; });
  const toJob = networkTo(net, endJ), toHome = networkTo(net, endH);
  for (const s of st) { s.board = 0; s.alight = 0; }
  for (const z of zones) {
    const res = w.kind[z.i] === T.RES, R = res ? toJob : toHome;
    let best = Infinity, bs = -1;
    for (let k = 0; k < st.length; k++) {
      if (!serving(st[k]) || R.cost[k] === Infinity || R.exit[k] === k) continue;      // walking to the station next to work isn't a ride
      const d = Math.hypot(z.x + 0.5 - st[k].cx, z.y + 0.5 - st[k].cy); if (d > WALK_R) continue;
      const c = d * WALK + BOARD + R.cost[k]; if (c < best) { best = c; bs = k; }
    }
    if (bs < 0) continue;
    out[z.i] = best; sim.metroVia[z.i] = bs * 1024 + R.exit[bs];
    if (res) { const p = POP_CAP[z.l] || 0; st[bs].board += p; st[R.exit[bs]].alight += p; }
  }
  sim.metroStops = { toJob, toHome };
  return out;
}

// Where a metro line would help most: groups of homes with no jobs in reach, and groups of jobs with no workers in reach,
// by district (6 by 6 tiles), paired up into arrows. Read by the Metro view and the advisors.
export function metroNeed(sim, DISTRICT, DISTRICTS) {
  const w = sim.w, H = new Float32Array(DISTRICTS * DISTRICTS), J = new Float32Array(DISTRICTS * DISTRICTS), hx = new Float32Array(H.length), hy = new Float32Array(H.length), jx = new Float32Array(H.length), jy = new Float32Array(H.length);
  for (let i = 0; i < N * N; i++) {
    const k = w.kind[i]; if (k !== T.RES && k !== T.COM && k !== T.IND) continue;
    const l = sim.lvl(i); if (!l) continue;
    const x = i % N, y = (i / N) | 0, d = ((y / DISTRICT) | 0) * DISTRICTS + ((x / DISTRICT) | 0);
    if (k === T.RES && !sim.jobReach[i]) { const p = POP_CAP[l]; H[d] += p; hx[d] += x * p; hy[d] += y * p; }
    else if (k !== T.RES && !sim.workReach[i]) { const p = 6 * l; J[d] += p; jx[d] += x * p; jy[d] += y * p; }
  }
  const hs = [], js = [];
  for (let d = 0; d < H.length; d++) { if (H[d] >= 20) hs.push({ n: H[d], x: hx[d] / H[d], y: hy[d] / H[d] }); if (J[d] >= 12) js.push({ n: J[d], x: jx[d] / J[d], y: jy[d] / J[d] }); }
  hs.sort((a, b) => b.n - a.n); js.sort((a, b) => b.n - a.n);
  const arrows = [];
  for (const h of hs.slice(0, 4)) {
    let best = null, bv = 0;
    for (const j of js.slice(0, 8)) { const dd = Math.hypot(h.x - j.x, h.y - j.y); if (dd < 10) continue; const v = Math.min(h.n, j.n * 3) / (1 + dd / 50); if (v > bv) { bv = v; best = j; } }
    if (best) arrows.push({ fx: h.x, fy: h.y, tx: best.x, ty: best.y, n: Math.round(h.n) });
  }
  // no empty jobs anywhere: point the stranded homes at the biggest job areas
  if (!arrows.length && hs.length) {
    const big = []; const JB = new Float32Array(H.length), bx = new Float32Array(H.length), by = new Float32Array(H.length);
    for (let i = 0; i < N * N; i++) { const k = w.kind[i]; if (k !== T.COM && k !== T.IND) continue; const l = sim.lvl(i); if (!l) continue; const x = i % N, y = (i / N) | 0, d = ((y / DISTRICT) | 0) * DISTRICTS + ((x / DISTRICT) | 0); JB[d] += l; bx[d] += x * l; by[d] += y * l; }
    for (let d = 0; d < H.length; d++) if (JB[d] >= 8) big.push({ n: JB[d], x: bx[d] / JB[d], y: by[d] / JB[d] });
    big.sort((a, b) => b.n - a.n);
    for (const h of hs.slice(0, 3)) { let best = null, bd = 1e9; for (const j of big.slice(0, 6)) { const dd = Math.hypot(h.x - j.x, h.y - j.y); if (dd >= 10 && dd < bd) { bd = dd; best = j; } } if (best) arrows.push({ fx: h.x, fy: h.y, tx: best.x, ty: best.y, n: Math.round(h.n) }); }
  }
  return arrows;
}

// For one citizen's trip (agents.js): the stations to use, if the metro beats the road. `roadTiles` is the length of the
// road route. Returns { A, B, ride } (A and B as small boxes for the walking routes) or null.
export function metroPlan(sim, fx, fy, tx, ty, roadTiles) {
  const net = sim.metroNet; if (!net || !net.st.length) return null;
  const st = net.st;
  let a = null, da = 1e9, b = null, db = 1e9;
  for (const s of st) { if (!serving(s)) continue; const d1 = Math.hypot(fx - s.cx, fy - s.cy), d2 = Math.hypot(tx - s.cx, ty - s.cy); if (d1 < da) { da = d1; a = s; } if (d2 < db) { db = d2; b = s; } }
  if (!a || !b || a === b || a.comp !== b.comp || da > WALK_R || db > WALK_R) return null;
  // the ride: a quick search over the stations
  const idx = new Map(st.map((s, k) => [s.i, k])), cost = new Float64Array(st.length).fill(Infinity), done = new Uint8Array(st.length);
  cost[idx.get(a.i)] = 0;
  for (;;) {
    let u = -1, bu = Infinity; for (let k = 0; k < st.length; k++) if (!done[k] && cost[k] < bu) { bu = cost[k]; u = k; }
    if (u < 0) break; done[u] = 1; if (st[u] === b) break;
    for (const l of st[u].links) { const v = idx.get(l.to); if (!serving(st[v])) continue; const c = cost[u] + l.len * RIDE + STOP + (st[u].links.length >= 3 && st[u] !== a ? CHANGE : 0); if (c < cost[v]) cost[v] = c; }
  }
  const ride = cost[idx.get(b.i)]; if (ride === Infinity) return null;
  if ((da + db) * WALK + BOARD + ride >= roadTiles) return null;
  return { A: { x: a.x, y: a.y, w: 1, d: 1 }, B: { x: b.x, y: b.y, w: 1, d: 1 }, ride };
}

export function canLink(sim, a, b) {
  const w = sim.w, ok = (i) => w.kind[i] === T.SVC && w.bo[i] === 0 && BT[w.bt[i]] && BT[w.bt[i]].metro;
  if (!ok(a) || !ok(b)) return { ok: false, why: 'Tap a metro station' };
  if (a === b) return { ok: false, why: 'Tap a different station to link it to' };
  if ((sim.metroLinks || []).some((l) => key(...l) === key(a, b))) return { ok: false, why: 'These two stations are already linked' };
  const len = Math.hypot((a % N) - (b % N), ((a / N) | 0) - ((b / N) | 0));
  return { ok: true, len, cost: Math.round(len * TUNNEL) };
}
