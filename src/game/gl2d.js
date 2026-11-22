// GPU drawing for the main view.
//
// The renderer was written against the browser's 2D canvas. This file gives it the same small set of calls
// (paths, fills, strokes, images, gradients, patterns, one clip, text) but draws everything with WebGL2:
//   - every cached picture (buildings, trees, roads, cars...) is packed into a few big texture pages once,
//     so a whole frame goes to the graphics chip in a handful of draw calls instead of thousands;
//   - shapes are turned into triangles and batched together with the pictures, in the same painter order;
//   - "lighter" (additive glow) is done inside the same batch, so night lights don't break it up.
// If WebGL2 isn't available the renderer gets a normal 2D canvas instead (createContext below).

const PAGE = 2048, PAD = 2, MAX_PAGES = 5, SOLO_UNIT = 6, SOLO_MAX = 1024;
const STRIDE = 6;                                   // x, y, u, v, texture slot, packed color
const MAX_VERTS = 60000;
const TAU = Math.PI * 2;

// ---------- colors ----------
const colorCache = new Map();
let probe = null;
function parseColor(s) {
  let c = colorCache.get(s);
  if (c) return c;
  c = parseColorRaw(s);
  if (colorCache.size > 5000) colorCache.clear();
  colorCache.set(s, c);
  return c;
}
function parseColorRaw(s) {
  if (typeof s !== 'string') return [0, 0, 0, 1];
  if (s[0] === '#') {
    const h = s.slice(1);
    if (h.length === 3 || h.length === 4) { const v = h.split('').map((d) => parseInt(d + d, 16)); return [v[0], v[1], v[2], h.length === 4 ? v[3] / 255 : 1]; }
    if (h.length === 6 || h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  const m = /^rgba?\(([^)]*)\)/i.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return [p[0] || 0, p[1] || 0, p[2] || 0, p.length > 3 ? p[3] : 1];
  }
  if (s === 'transparent') return [0, 0, 0, 0];
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  probe.fillStyle = '#000'; probe.fillStyle = s;
  const n = probe.fillStyle;
  return n === s ? [0, 0, 0, 1] : parseColorRaw(n);
}
const pack = (r, g, b, a) => ((Math.round(r * a) & 255) | ((Math.round(g * a) & 255) << 8) | ((Math.round(b * a) & 255) << 16) | ((Math.round(a * 255) & 255) << 24)) >>> 0;

class Gradient {
  constructor(kind, a) { this.kind = kind; this.a = a; this.stops = []; }
  addColorStop(o, c) { this.stops.push([Math.max(0, Math.min(1, o)), parseColor(c)]); this.stops.sort((x, y) => x[0] - y[0]); }
  at(t) {                                            // color at gradient position t, as [r, g, b, a]
    const s = this.stops; if (!s.length) return [0, 0, 0, 0];
    if (t <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) if (t <= s[i][0]) { const [o0, c0] = s[i - 1], [o1, c1] = s[i], f = o1 > o0 ? (t - o0) / (o1 - o0) : 1; return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f, c0[3] + (c1[3] - c0[3]) * f]; }
    return s[s.length - 1][1];
  }
}
class Pattern { constructor(img) { this.img = img; } }

// ---------- geometry helpers ----------
function convex(p) {
  const n = p.length / 2; if (n < 4) return true;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2, c = ((i + 2) % n) * 2;
    const cr = (p[b] - p[a]) * (p[c + 1] - p[b + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[b]);
    if (Math.abs(cr) < 1e-6) continue;
    const s = cr > 0 ? 1 : -1; if (!sign) sign = s; else if (s !== sign) return false;
  }
  return true;
}
// Triangulate a simple polygon (flat [x, y, ...]); returns flat triangle vertex list.
function triangulate(p, out) {
  const n = p.length / 2; if (n < 3) return out;
  if (convex(p)) { for (let i = 1; i < n - 1; i++) out.push(p[0], p[1], p[i * 2], p[i * 2 + 1], p[i * 2 + 2], p[i * 2 + 3]); return out; }
  let area = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
  const idx = []; for (let i = 0; i < n; i++) idx.push(i);
  const ccw = area > 0, X = (i) => p[i * 2], Y = (i) => p[i * 2 + 1];
  const inside = (a, b, c, q) => { const d1 = (X(b) - X(a)) * (Y(q) - Y(a)) - (Y(b) - Y(a)) * (X(q) - X(a)), d2 = (X(c) - X(b)) * (Y(q) - Y(b)) - (Y(c) - Y(b)) * (X(q) - X(b)), d3 = (X(a) - X(c)) * (Y(q) - Y(c)) - (Y(a) - Y(c)) * (X(q) - X(c)); return ccw ? d1 >= 0 && d2 >= 0 && d3 >= 0 : d1 <= 0 && d2 <= 0 && d3 <= 0; };
  let guard = n * n;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k + idx.length - 1) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
      const cr = (X(b) - X(a)) * (Y(c) - Y(b)) - (Y(b) - Y(a)) * (X(c) - X(b));
      if (ccw ? cr <= 0 : cr >= 0) continue;
      let ok = true; for (const q of idx) if (q !== a && q !== b && q !== c && inside(a, b, c, q)) { ok = false; break; }
      if (!ok) continue;
      out.push(X(a), Y(a), X(b), Y(b), X(c), Y(c)); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) break;
  }
  for (let i = 1; i < idx.length - 1; i++) out.push(X(idx[0]), Y(idx[0]), X(idx[i]), Y(idx[i]), X(idx[i + 1]), Y(idx[i + 1]));
  return out;
}
// Keep the part of polygon poly (flat, with an extra per-vertex value) where f(x, y) >= 0; f is affine.
function clipPoly(poly, f) {
  const out = [], n = poly.length / 3;
  for (let i = 0; i < n; i++) {
    const a = i * 3, b = ((i + 1) % n) * 3, fa = f(poly[a], poly[a + 1]), fb = f(poly[b], poly[b + 1]);
    if (fa >= 0) out.push(poly[a], poly[a + 1], poly[a + 2]);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push(poly[a] + (poly[b] - poly[a]) * t, poly[a + 1] + (poly[b + 1] - poly[a + 1]) * t, poly[a + 2] + (poly[b + 2] - poly[a + 2]) * t); }
  }
  return out;
}

const VS = `#version 300 es
in vec2 a_p; in vec2 a_uv; in float a_t; in vec4 a_c;
uniform vec2 u_res;
out highp vec2 v_uv; flat out float v_t; out vec4 v_c;
void main() { v_uv = a_uv; v_t = a_t; v_c = a_c; gl_Position = vec4(a_p.x / u_res.x * 2.0 - 1.0, 1.0 - a_p.y / u_res.y * 2.0, 0.0, 1.0); }`;
// The texture slot carries a few effect flags on top: +8 additive ("lighter"), +16 animated water surface,
// +32 rippled reflection.
const FS = `#version 300 es
precision mediump float;
in highp vec2 v_uv; flat in float v_t; in vec4 v_c;
uniform sampler2D u_t0, u_t1, u_t2, u_t3, u_t4, u_t5, u_t6;
uniform highp float u_time; uniform vec4 u_sun; uniform float u_tiles; uniform vec4 u_sky; uniform highp vec2 u_res;
out vec4 o;
vec4 tex(int i, highp vec2 uv) {
  if (i == 0) return texture(u_t0, uv); if (i == 1) return texture(u_t1, uv); if (i == 2) return texture(u_t2, uv);
  if (i == 3) return texture(u_t3, uv); if (i == 4) return texture(u_t4, uv); if (i == 5) return texture(u_t5, uv);
  return texture(u_t6, uv);
}
void main() {
  float t = v_t;
  bool wob = t > 31.5; if (wob) t -= 32.0;
  bool wat = t > 15.5; if (wat) t -= 16.0;
  bool add = t > 7.5; if (add) t -= 8.0;
  highp vec2 uv = v_uv;
  if (wob) uv.x += sin(gl_FragCoord.y * 0.42 + u_time * 2.2) * 0.0011;      // a reflection broken up by small waves
  vec4 c = tex(int(t + 0.5), uv) * v_c;
  if (wat) {
    highp vec2 p = v_uv * u_tiles;                                            // tile coordinates across the whole sea
    float a = sin(p.x * 1.9 + p.y * 0.6 + u_time * 0.9) + sin(p.y * 2.3 - p.x * 0.5 - u_time * 0.7);
    float b = sin((p.x + p.y) * 3.7 + u_time * 1.6) + sin((p.x - p.y) * 4.4 - u_time * 1.2);
    c.rgb *= 1.0 + a * 0.035 + b * 0.022;                                     // slow swells and small waves
    float far = smoothstep(0.0, 1.0, gl_FragCoord.y / u_res.y);              // the far water (top of the screen) mirrors more sky
    c.rgb = mix(c.rgb, u_sky.rgb, u_sky.a * far * (0.85 + 0.15 * a));
    highp vec2 q = p * 5.0, cell = floor(q); vec2 f = fract(q) - 0.5;
    float r = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float tw = sin(u_time * (2.0 + r * 3.0) + r * 40.0);
    float crest = clamp(b * 0.5 + a * 0.25, 0.0, 1.0);
    float s = step(0.955, r) * max(0.0, tw) * max(0.0, 1.0 - length(f) * 3.6) * crest;   // sun glints that twinkle on the wave crests
    c.rgb += u_sun.rgb * u_sun.a * s * 1.4;
  }
  o = c;
  if (add) o.a = 0.0;          // premultiplied colour with zero alpha adds onto what is below: "lighter"
}`;

export class GLContext2D {
  constructor(canvas, gl) {
    this.canvas = canvas; this.gl = gl; this.engine = 'GPU (WebGL2)'; this.gpu = true; this.fx = 0;
    this.lost = false; this.frame = 0;
    this.stat = { uploads: 0, upPx: 0, recycles: 0, solo: 0, upMs: 0 };   // counters for the test tools' stutter readout
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; }, false);
    canvas.addEventListener('webglcontextrestored', () => { this.init(); this.lost = false; }, false);
    const buf = new ArrayBuffer(MAX_VERTS * STRIDE * 4);
    this.f32 = new Float32Array(buf); this.u32 = new Uint32Array(buf); this.n = 0;
    this.reset(); this.init();
  }
  reset() {
    this.m = [1, 0, 0, 1, 0, 0]; this.stack = [];
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.globalAlpha = 1; this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter';
    this.globalCompositeOperation = 'source-over'; this.font = '10px sans-serif'; this.textAlign = 'start'; this.textBaseline = 'alphabetic';
    this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'low'; this.filter = 'none'; this.lineDashOffset = 0; this.dash = []; this.clipOn = false; this.fx = 0;
    this.subs = []; this.cur = null;
  }
  init() {
    const gl = this.gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = this.prog = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    this.uRes = gl.getUniformLocation(pr, 'u_res'); this.uTime = gl.getUniformLocation(pr, 'u_time'); this.uSun = gl.getUniformLocation(pr, 'u_sun'); this.uTiles = gl.getUniformLocation(pr, 'u_tiles'); this.uSky = gl.getUniformLocation(pr, 'u_sky');
    gl.uniform1f(this.uTime, 0); gl.uniform4f(this.uSun, 0, 0, 0, 0); gl.uniform1f(this.uTiles, 96); gl.uniform4f(this.uSky, 0, 0, 0, 0);
    for (let i = 0; i <= 6; i++) gl.uniform1i(gl.getUniformLocation(pr, 'u_t' + i), i);
    this.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const at = (name, size, type, norm, off) => { const l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, type, norm, STRIDE * 4, off); };
    at('a_p', 2, gl.FLOAT, false, 0); at('a_uv', 2, gl.FLOAT, false, 8); at('a_t', 1, gl.FLOAT, false, 16); at('a_c', 4, gl.UNSIGNED_BYTE, true, 20);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.pages = []; this.entries = new WeakMap(); this.solos = new WeakMap(); this.solo = null;
    this.newPage();                                         // page 0 always exists: it holds the white texel for plain shapes
    this.dummy = this.pages[0].tex;
    for (let i = 1; i <= 6; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.dummy); }
    this.n = 0;
  }
  // ---------- texture pages ----------
  newPage() {
    const gl = this.gl, tex = gl.createTexture(), unit = this.pages.length;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PAGE, PAGE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const page = { tex, unit, gen: 1, used: this.frame, shelves: [], y: 0 };
    this.pages.push(page); this.whiten(page);
    return page;
  }
  whiten(page) {
    if (page.unit !== 0) return;
    const gl = this.gl, w = new Uint8Array(8 * 8 * 4).fill(255);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, page.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, w);
    page.shelves = [{ y: 0, h: 8 + PAD, x: 8 + PAD }]; page.y = 8 + PAD;
    this.wu = 4 / PAGE; this.wv = 4 / PAGE;
  }
  recycle(page) {                                           // reuse the least recently drawn page: wipe it and start over
    this.flush();
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + page.unit); gl.bindTexture(gl.TEXTURE_2D, page.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PAGE, PAGE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    page.gen++; page.shelves = []; page.y = 0; this.whiten(page); this.stat.recycles++;
  }
  alloc(w, h) {
    const W = w + PAD * 2, H = h + PAD * 2;
    for (const page of this.pages) { const r = this.place(page, W, H); if (r) return r; }
    if (this.pages.length < MAX_PAGES) return this.place(this.newPage(), W, H);
    let old = this.pages[0];                                   // least recently drawn page (never page 0's white texel twice in a row if avoidable)
    for (const p of this.pages) if (p.used < old.used) old = p;
    this.recycle(old);
    return this.place(old, W, H);
  }
  place(page, W, H) {
    for (const s of page.shelves) if (H <= s.h && H >= s.h * 0.6 && s.x + W <= PAGE) { const r = { page, x: s.x + PAD, y: s.y + PAD }; s.x += W; return r; }
    if (page.y + H > PAGE || W > PAGE) return null;
    const s = { y: page.y, h: H, x: W }; page.shelves.push(s); page.y += H;
    return { page, x: PAD, y: s.y + PAD };
  }
  entry(img) {
    const w = img.width, h = img.height;
    if (img._solo || w > SOLO_MAX || h > SOLO_MAX) return this.soloEntry(img);
    let e = this.entries.get(img);
    const v = img._v | 0;
    if (e && e.gen === e.page.gen && e.w === w && e.h === h) {
      if (e.v !== v) { this.upload(e.page, e.x, e.y, img); e.v = v; }
      e.page.used = this.frame; return e;
    }
    const r = this.alloc(w, h);
    if (!r) return this.soloEntry(img);
    this.upload(r.page, r.x, r.y, img);
    e = { page: r.page, gen: r.page.gen, x: r.x, y: r.y, w, h, v, slot: r.page.unit, u0: r.x / PAGE, v0: r.y / PAGE, su: 1 / PAGE, sv: 1 / PAGE };
    r.page.used = this.frame; this.entries.set(img, e);
    return e;
  }
  upload(page, x, y, img) {
    const gl = this.gl, t0 = performance.now();
    gl.activeTexture(gl.TEXTURE0 + page.unit); gl.bindTexture(gl.TEXTURE_2D, page.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const st = this.stat; st.uploads++; st.upPx += img.width * img.height; st.upMs += performance.now() - t0;
  }
  // Big or changing pictures (the ground cache, the sea, the ripple pattern) get a texture of their own.
  soloEntry(img, repeat) {
    const gl = this.gl;
    let e = this.solos.get(img);
    const v = img._v | 0;
    if (!e || e.w !== img.width || e.h !== img.height) {
      if (e) gl.deleteTexture(e.tex);
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + SOLO_UNIT); gl.bindTexture(gl.TEXTURE_2D, tex); this.soloBound = tex;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      const mipped = !repeat && (img.width > 256 || img.height > 256);
      if (mipped) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipped ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      e = { tex, w: img.width, h: img.height, v, mipped, slot: SOLO_UNIT, u0: 0, v0: 0, su: 1 / img.width, sv: 1 / img.height, solo: true };
      this.solos.set(img, e); img._dr = null;
    } else if (e.v !== v) {                                 // changed since last time: upload only the part that changed
      this.flushIfSolo(e.tex);
      gl.activeTexture(gl.TEXTURE0 + SOLO_UNIT); gl.bindTexture(gl.TEXTURE_2D, e.tex); this.soloBound = e.tex;
      const r = img._dr;
      if (r) {
        const x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(0, Math.floor(r[1])), x1 = Math.min(img.width, Math.ceil(r[2])), y1 = Math.min(img.height, Math.ceil(r[3]));
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, img.width); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
      } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (e.mipped) gl.generateMipmap(gl.TEXTURE_2D);
      e.v = v; img._dr = null; this.stat.solo++;
    }
    if (this.solo !== e.tex) { this.flush(); this.solo = e.tex; }
    if (this.soloBound !== e.tex) { gl.activeTexture(gl.TEXTURE0 + SOLO_UNIT); gl.bindTexture(gl.TEXTURE_2D, e.tex); this.soloBound = e.tex; }
    return e;
  }
  // Light for the water effects: time drives the waves, sun is the colour and strength of the glints.
  setLight(time, r, g, b, a, tiles, sky) {
    this.flush(); const gl = this.gl;
    gl.uniform1f(this.uTime, time); gl.uniform4f(this.uSun, r, g, b, a); if (tiles) gl.uniform1f(this.uTiles, tiles);
    if (sky) gl.uniform4f(this.uSky, sky[0], sky[1], sky[2], sky[3]);
  }
  // A picture drawn upside down, fading from aTop to aBottom and tinted, with small ripples: a reflection on water.
  drawMirror(img, sx, sy, sw, sh, dx, dy, dw, dh, aTop, aBottom, tr, tg, tb) {
    if (this.lost || !img || !img.width || sw <= 0 || sh <= 0) return;
    const en = this.entry(img), slot = en.slot + 32;
    const u0 = en.u0 + sx * en.su, v0 = en.v0 + sy * en.sv, u1 = en.u0 + (sx + sw) * en.su, v1 = en.v0 + (sy + sh) * en.sv;
    const ct = pack(tr * 255, tg * 255, tb * 255, aTop), cb = pack(tr * 255, tg * 255, tb * 255, aBottom);
    const m = this.m, P = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    const p0 = P(dx, dy), p1 = P(dx + dw, dy), p2 = P(dx + dw, dy + dh), p3 = P(dx, dy + dh);
    this.room(6);                                              // top of the reflection shows the bottom of the picture
    this.vert(p0[0], p0[1], u0, v1, slot, ct); this.vert(p1[0], p1[1], u1, v1, slot, ct); this.vert(p2[0], p2[1], u1, v0, slot, cb);
    this.vert(p0[0], p0[1], u0, v1, slot, ct); this.vert(p2[0], p2[1], u1, v0, slot, cb); this.vert(p3[0], p3[1], u0, v0, slot, cb);
  }
  canWarm() { return this.pages.length < MAX_PAGES; }     // only fill free pages ahead of time, never push out pictures in use
  flushIfSolo(tex) { if (this.solo === tex && this.n) this.flush(); }

  // ---------- frame ----------
  begin() {
    const gl = this.gl; this.frame++;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog); gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.disable(gl.STENCIL_TEST); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.reset(); this.n = 0;
  }
  end() { this.flush(); }
  flush() {
    if (!this.n || this.lost) { this.n = 0; return; }
    const gl = this.gl;
    for (const p of this.pages) { gl.activeTexture(gl.TEXTURE0 + p.unit); gl.bindTexture(gl.TEXTURE_2D, p.tex); }
    gl.activeTexture(gl.TEXTURE0 + SOLO_UNIT); gl.bindTexture(gl.TEXTURE_2D, this.solo || this.dummy); this.soloBound = this.solo || this.dummy;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.f32.subarray(0, this.n * STRIDE), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, this.n);
    this.n = 0;
  }
  vert(x, y, u, v, slot, col) {
    if (this.n >= MAX_VERTS) this.flush();
    const o = this.n * STRIDE; this.f32[o] = x; this.f32[o + 1] = y; this.f32[o + 2] = u; this.f32[o + 3] = v; this.f32[o + 4] = slot; this.u32[o + 5] = col; this.n++;
  }
  room(k) { if (this.n + k > MAX_VERTS) this.flush(); }
  get add() { return this.globalCompositeOperation === 'lighter' ? 8 : 0; }

  // ---------- state ----------
  save() { this.stack.push({ m: this.m.slice(), fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, globalAlpha: this.globalAlpha, lineWidth: this.lineWidth, lineCap: this.lineCap, lineJoin: this.lineJoin, globalCompositeOperation: this.globalCompositeOperation, font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline, dash: this.dash, lineDashOffset: this.lineDashOffset, clipOn: this.clipOn, imageSmoothingEnabled: this.imageSmoothingEnabled }); }
  restore() {
    const s = this.stack.pop(); if (!s) return;
    if (this.clipOn && !s.clipOn) { this.flush(); this.gl.disable(this.gl.STENCIL_TEST); }
    Object.assign(this, s);
  }
  setTransform(a, b, c, d, e, f) { if (typeof a === 'object' && a) { this.m = [a.a, a.b, a.c, a.d, a.e, a.f]; return; } this.m = [a, b, c, d, e, f]; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(x, y) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }
  getTransform() { const m = this.m; return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; }
  setLineDash(d) { this.dash = d ? d.slice() : []; }
  getLineDash() { return this.dash.slice(); }
  get scaleK() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
  tx(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  // ---------- paths (stored already transformed to screen pixels) ----------
  beginPath() { this.subs = []; this.cur = null; }
  moveTo(x, y) { const p = this.tx(x, y); this.cur = { p: [p[0], p[1]], closed: false }; this.subs.push(this.cur); }
  lineTo(x, y) { if (!this.cur) { this.moveTo(x, y); return; } const p = this.tx(x, y), q = this.cur.p; if (q[q.length - 2] !== p[0] || q[q.length - 1] !== p[1]) q.push(p[0], p[1]); }
  closePath() { if (this.cur) { this.cur.closed = true; const q = this.cur.p; this.cur = { p: [q[0], q[1]], closed: false }; this.subs.push(this.cur); } }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  last() { const q = this.cur.p; return [q[q.length - 2], q[q.length - 1]]; }
  quadraticCurveTo(cx, cy, x, y) {
    if (!this.cur) this.moveTo(cx, cy);
    const p0 = this.last(), c = this.tx(cx, cy), p1 = this.tx(x, y), q = this.cur.p;
    const n = Math.max(2, Math.min(24, Math.ceil((Math.hypot(c[0] - p0[0], c[1] - p0[1]) + Math.hypot(p1[0] - c[0], p1[1] - c[1])) / 6)));
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; q.push(u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]); }
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    if (!this.cur) this.moveTo(c1x, c1y);
    const p0 = this.last(), a = this.tx(c1x, c1y), b = this.tx(c2x, c2y), p1 = this.tx(x, y), q = this.cur.p;
    const n = Math.max(3, Math.min(32, Math.ceil((Math.hypot(a[0] - p0[0], a[1] - p0[1]) + Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(p1[0] - b[0], p1[1] - b[1])) / 6)));
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; q.push(u * u * u * p0[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * p1[0], u * u * u * p0[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * p1[1]); }
  }
  arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
    let sw = a1 - a0;
    if (!ccw) sw = sw >= TAU ? TAU : ((sw % TAU) + TAU) % TAU;
    else sw = -sw >= TAU ? -TAU : -((((a0 - a1) % TAU) + TAU) % TAU);
    const k = this.scaleK, n = Math.max(6, Math.min(72, Math.ceil(Math.abs(sw) * Math.sqrt(Math.max(rx, ry) * k) * 1.3)));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sw * i) / n, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, px = x + ex * cr - ey * sr, py = y + ex * sr + ey * cr;
      if (i === 0 && !this.cur) this.moveTo(px, py); else this.lineTo(px, py);
    }
  }

  // ---------- filling ----------
  shapeTris() {
    const tris = [];
    for (const s of this.subs) if (s.p.length >= 6) triangulate(s.p, tris);
    return tris;
  }
  fill() {
    const st = this.fillStyle;
    if (typeof st !== 'string') { this.fillGradient(this.shapeTris(), st); return; }
    const c = parseColor(st), a = c[3] * this.globalAlpha; if (a <= 0) return;
    const col = pack(c[0], c[1], c[2], a), slot = this.add, u = this.wu, v = this.wv;
    for (const s of this.subs) {
      if (s.p.length < 6) continue;
      const t = triangulate(s.p, []); this.room(t.length / 2);
      for (let i = 0; i < t.length; i += 2) this.vert(t[i], t[i + 1], u, v, slot, col);
    }
  }
  fillRect(x, y, w, h) {
    const st = this.fillStyle;
    if (typeof st === 'string') {                            // the common case, with no garbage
      const k = parseColor(st), al = k[3] * this.globalAlpha; if (al <= 0) return;
      this.quad(x, y, w, h, this.wu, this.wv, this.wu, this.wv, this.add, pack(k[0], k[1], k[2], al)); return;
    }
    const a = this.tx(x, y), b = this.tx(x + w, y), c = this.tx(x + w, y + h), d = this.tx(x, y + h);
    if (st instanceof Pattern) { this.patternRect(x, y, w, h, a, b, c, d, st); return; }
    if (typeof st !== 'string') { this.fillGradient([a[0], a[1], b[0], b[1], c[0], c[1], a[0], a[1], c[0], c[1], d[0], d[1]], st); return; }
    const k = parseColor(st), al = k[3] * this.globalAlpha; if (al <= 0) return;
    const col = pack(k[0], k[1], k[2], al), slot = this.add, u = this.wu, v = this.wv;
    this.room(6);
    this.vert(a[0], a[1], u, v, slot, col); this.vert(b[0], b[1], u, v, slot, col); this.vert(c[0], c[1], u, v, slot, col);
    this.vert(a[0], a[1], u, v, slot, col); this.vert(c[0], c[1], u, v, slot, col); this.vert(d[0], d[1], u, v, slot, col);
  }
  strokeRect(x, y, w, h) { const s = this.subs, c = this.cur; this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.subs = s; this.cur = c; }
  clearRect() {}
  patternRect(x, y, w, h, a, b, c, d, pat) {
    const e = this.soloEntry(pat.img, true), al = this.globalAlpha; if (al <= 0) return;
    const col = pack(255, 255, 255, al), slot = SOLO_UNIT + this.add, iw = 1 / pat.img.width, ih = 1 / pat.img.height;
    this.room(6);
    const V = (p, ux, uy) => this.vert(p[0], p[1], ux * iw, uy * ih, slot, col);
    V(a, x, y); V(b, x + w, y); V(c, x + w, y + h); V(a, x, y); V(c, x + w, y + h); V(d, x, y + h);
    void e;
  }
  // Gradients: linear ones are cut into bands between their stops (exact); radial ones are drawn as rings.
  fillGradient(tris, g) {
    if (!(g instanceof Gradient) || tris.length < 6) return;
    const ga = this.globalAlpha, slot = this.add, u = this.wu, v = this.wv;
    const emit = (x, y, c) => this.vert(x, y, u, v, slot, pack(c[0], c[1], c[2], c[3] * ga));
    if (g.kind === 'linear') {
      const [x0, y0, x1, y1] = g.a, p0 = this.tx(x0, y0), p1 = this.tx(x1, y1), dx = p1[0] - p0[0], dy = p1[1] - p0[1], L2 = dx * dx + dy * dy || 1;
      const T = (x, y) => ((x - p0[0]) * dx + (y - p0[1]) * dy) / L2;
      const cuts = [-1e9, ...g.stops.map((s) => s[0]), 1e9];
      for (let i = 0; i < tris.length; i += 6) {
        const tri = [tris[i], tris[i + 1], T(tris[i], tris[i + 1]), tris[i + 2], tris[i + 3], T(tris[i + 2], tris[i + 3]), tris[i + 4], tris[i + 5], T(tris[i + 4], tris[i + 5])];
        for (let k = 0; k < cuts.length - 1; k++) {
          const lo = cuts[k], hi = cuts[k + 1]; if (hi <= lo) continue;
          let p = clipPoly(tri, (x, y) => T(x, y) - lo); if (p.length < 9) continue;
          p = clipPoly(p, (x, y) => hi - T(x, y)); if (p.length < 9) continue;
          const n = p.length / 3; this.room((n - 2) * 3);
          for (let j = 1; j < n - 1; j++) for (const q of [0, j, j + 1]) emit(p[q * 3], p[q * 3 + 1], g.at(p[q * 3 + 2]));
        }
      }
      return;
    }
    // radial: concentric rings around the gradient centre, clipped to the box of the shape being filled
    const [, , r0u, x1u, y1u, r1u] = g.a, k = this.scaleK, c = this.tx(x1u, y1u), r0 = r0u * k, r1 = Math.max(r0 + 0.01, r1u * k);
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (let i = 0; i < tris.length; i += 2) { bx0 = Math.min(bx0, tris[i]); bx1 = Math.max(bx1, tris[i]); by0 = Math.min(by0, tris[i + 1]); by1 = Math.max(by1, tris[i + 1]); }
    const far = Math.max(Math.hypot(bx0 - c[0], by0 - c[1]), Math.hypot(bx1 - c[0], by0 - c[1]), Math.hypot(bx0 - c[0], by1 - c[1]), Math.hypot(bx1 - c[0], by1 - c[1]));
    const radii = [0]; if (r0 > 0) radii.push(r0);
    for (const s of g.stops) radii.push(r0 + (r1 - r0) * s[0]);
    radii.push(r1); if (far > r1 && g.at(1)[3] > 0) radii.push(far + 1);
    const R = [...new Set(radii.map((r) => Math.round(r * 100) / 100))].sort((a, b) => a - b);
    const colAt = (r) => g.at(r <= r0 ? 0 : (r - r0) / (r1 - r0));
    const seg = Math.max(16, Math.min(48, Math.ceil(Math.sqrt(R[R.length - 1]) * 4)));
    const box = (p) => { p = clipPoly(p, (x) => x - bx0); if (p.length < 9) return p; p = clipPoly(p, (x) => bx1 - x); if (p.length < 9) return p; p = clipPoly(p, (x, y) => y - by0); if (p.length < 9) return p; return clipPoly(p, (x, y) => by1 - y); };
    const out = (p) => { const n = p.length / 3; if (n < 3) return; this.room((n - 2) * 3); for (let j = 1; j < n - 1; j++) for (const q of [0, j, j + 1]) emit(p[q * 3], p[q * 3 + 1], colAt(p[q * 3 + 2])); };
    for (let ri = 0; ri < R.length - 1; ri++) {
      const ra = R[ri], rb = R[ri + 1];
      if (ra * ra > 0 && colAt(ra)[3] <= 0.001 && colAt(rb)[3] <= 0.001) continue;     // fully transparent ring
      for (let s = 0; s < seg; s++) {
        const a0 = (s / seg) * TAU, a1 = ((s + 1) / seg) * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const quad = ra === 0
          ? [c[0], c[1], 0, c[0] + c0 * rb, c[1] + s0 * rb, rb, c[0] + c1 * rb, c[1] + s1 * rb, rb]
          : [c[0] + c0 * ra, c[1] + s0 * ra, ra, c[0] + c0 * rb, c[1] + s0 * rb, rb, c[0] + c1 * rb, c[1] + s1 * rb, rb, c[0] + c1 * ra, c[1] + s1 * ra, ra];
        out(box(quad));
      }
    }
  }
  createLinearGradient(x0, y0, x1, y1) { return new Gradient('linear', [x0, y0, x1, y1]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient('radial', [x0, y0, r0, x1, y1, r1]); }
  createPattern(img) { return new Pattern(img); }

  // ---------- stroking ----------
  stroke() {
    const st = this.strokeStyle; const c = typeof st === 'string' ? parseColor(st) : (st instanceof Gradient ? st.at(0.5) : [255, 255, 255, 1]);
    let lw = this.lineWidth * this.scaleK, a = c[3] * this.globalAlpha;
    if (lw < 1) { a *= lw; lw = 1; }
    if (a <= 0) return;
    const col = pack(c[0], c[1], c[2], a), slot = this.add, u = this.wu, v = this.wv, hw = lw / 2;
    const capExt = this.lineCap === 'butt' ? 0 : hw, joinExt = a >= 0.98 ? hw * 0.6 : 0;
    const dash = this.dash.length ? this.dash.map((d) => d * this.scaleK) : null, dashTotal = dash ? dash.reduce((s, d) => s + d, 0) : 0;
    const seg = (x0, y0, x1, y1, e0, e1) => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 1e-3) return;
      const ux = dx / L, uy = dy / L, nx = -uy * hw, ny = ux * hw;
      const ax = x0 - ux * e0, ay = y0 - uy * e0, bx = x1 + ux * e1, by = y1 + uy * e1;
      this.room(6);
      this.vert(ax + nx, ay + ny, u, v, slot, col); this.vert(bx + nx, by + ny, u, v, slot, col); this.vert(bx - nx, by - ny, u, v, slot, col);
      this.vert(ax + nx, ay + ny, u, v, slot, col); this.vert(bx - nx, by - ny, u, v, slot, col); this.vert(ax - nx, ay - ny, u, v, slot, col);
    };
    for (const s of this.subs) {
      const p = s.p.slice(); if (s.closed) p.push(p[0], p[1]);
      const n = p.length / 2; if (n < 2) continue;
      if (!dash || dashTotal <= 0) {
        for (let i = 0; i < n - 1; i++) seg(p[i * 2], p[i * 2 + 1], p[i * 2 + 2], p[i * 2 + 3], i === 0 && !s.closed ? capExt : joinExt, i === n - 2 && !s.closed ? capExt : joinExt);
        continue;
      }
      let di = 0, left = dash[0], on = true;
      let off = ((this.lineDashOffset * this.scaleK) % dashTotal + dashTotal) % dashTotal;
      while (off > 0) { if (off >= left) { off -= left; di = (di + 1) % dash.length; left = dash[di]; on = !on; } else { left -= off; off = 0; } }
      for (let i = 0; i < n - 1; i++) {
        let x0 = p[i * 2], y0 = p[i * 2 + 1]; const x1 = p[i * 2 + 2], y1 = p[i * 2 + 3]; let L = Math.hypot(x1 - x0, y1 - y0);
        const ux = L ? (x1 - x0) / L : 0, uy = L ? (y1 - y0) / L : 0;
        while (L > 1e-3) {
          const d = Math.min(left, L);
          if (on) seg(x0, y0, x0 + ux * d, y0 + uy * d, capExt, capExt);
          x0 += ux * d; y0 += uy * d; L -= d; left -= d;
          if (left <= 1e-3) { di = (di + 1) % dash.length; left = dash[di]; on = !on; }
        }
      }
    }
  }

  // ---------- clipping (one level, with the stencil buffer) ----------
  clip() {
    const gl = this.gl, t = this.shapeTris(); this.flush();
    gl.enable(gl.STENCIL_TEST); gl.clearStencil(0); gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); gl.colorMask(false, false, false, false);
    const col = pack(255, 255, 255, 1);
    for (let i = 0; i < t.length; i += 2) this.vert(t[i], t[i + 1], this.wu, this.wv, 0, col);
    this.flush();
    gl.colorMask(true, true, true, true); gl.stencilFunc(gl.EQUAL, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    this.clipOn = true;
  }

  // ---------- pictures ----------
  drawImage(img, a, b, c, d, e, f, g, h) {
    if (this.lost || !img || !img.width || !img.height) return;
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (e === undefined) { dx = a; dy = b; dw = c === undefined ? sw : c; dh = d === undefined ? sh : d; }
    else { sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g; dh = h; }
    const al = this.globalAlpha; if (al <= 0 || dw === 0 || dh === 0) return;
    const en = this.entry(img), col = pack(255, 255, 255, al), slot = en.slot + this.add + this.fx;
    const u0 = en.u0 + sx * en.su, v0 = en.v0 + sy * en.sv, u1 = en.u0 + (sx + sw) * en.su, v1 = en.v0 + (sy + sh) * en.sv;
    this.quad(dx, dy, dw, dh, u0, v0, u1, v1, slot, col);
  }
  // one rectangle (in user space) as two triangles, without making any garbage
  quad(dx, dy, dw, dh, u0, v0, u1, v1, slot, col) {
    const m = this.m, a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], x1 = dx + dw, y1 = dy + dh;
    const ax = a * dx + c * dy + e, ay = b * dx + d * dy + f, bx = a * x1 + c * dy + e, by = b * x1 + d * dy + f;
    const cx = a * x1 + c * y1 + e, cy = b * x1 + d * y1 + f, qx = a * dx + c * y1 + e, qy = b * dx + d * y1 + f;
    this.room(6);
    this.vert(ax, ay, u0, v0, slot, col); this.vert(bx, by, u1, v0, slot, col); this.vert(cx, cy, u1, v1, slot, col);
    this.vert(ax, ay, u0, v0, slot, col); this.vert(cx, cy, u1, v1, slot, col); this.vert(qx, qy, u0, v1, slot, col);
  }

  // ---------- text (rendered once into a small picture, then drawn like any other) ----------
  fillText(text, x, y) {
    const k = Math.max(1, Math.round(this.scaleK * 4) / 4), key = `${text}|${this.font}|${this.fillStyle}|${this.textAlign}|${this.textBaseline}|${k}`;
    const cache = this.textCache || (this.textCache = new Map());
    let t = cache.get(key);
    if (!t) {
      const size = parseFloat((/(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 10])[1]), font = this.font.replace(/(\d+(?:\.\d+)?)px/, `${size * k}px`);
      const c = document.createElement('canvas'), x2 = c.getContext('2d'); x2.font = font;
      const w = Math.ceil(x2.measureText(text).width) + 4, H = Math.ceil(size * k * 2) + 4;
      c.width = w; c.height = H;
      x2.font = font; x2.fillStyle = typeof this.fillStyle === 'string' ? this.fillStyle : '#fff'; x2.textAlign = this.textAlign; x2.textBaseline = this.textBaseline;
      const ox = this.textAlign === 'center' ? w / 2 : this.textAlign === 'right' || this.textAlign === 'end' ? w - 2 : 2, oy = Math.round(size * k * 1.1) + 2;
      x2.fillText(text, ox, oy);
      t = { c, ox, oy, k }; if (cache.size > 200) cache.clear(); cache.set(key, t);
    }
    this.drawImage(t.c, x - t.ox / t.k, y - t.oy / t.k, t.c.width / t.k, t.c.height / t.k);
  }
  strokeText() {}
  measureText(s) { if (!probe) probe = document.createElement('canvas').getContext('2d'); probe.font = this.font; return probe.measureText(s); }
}

// Pick the drawing engine for the main view: the graphics chip when possible, the plain 2D canvas otherwise.
export function createContext(canvas) {
  let force2d = false;
  try { force2d = localStorage.getItem('skyline.engine') === '2d'; } catch (e) { /* ignore */ }
  if (!force2d) {
    try {
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, stencil: true, depth: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (gl) return new GLContext2D(canvas, gl);
    } catch (e) { console.warn('WebGL2 unavailable, using the 2D canvas', e); }
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.engine = 'Canvas 2D';
  return ctx;
}

// Tell the GPU engine that a picture changed after it was first drawn (optionally only a rectangle of it).
export function touched(canvas, x0, y0, x1, y1) {
  canvas._v = (canvas._v | 0) + 1;
  if (x0 === undefined) { canvas._dr = [0, 0, canvas.width, canvas.height]; return; }
  const r = canvas._dr;
  canvas._dr = r ? [Math.min(r[0], x0), Math.min(r[1], y0), Math.max(r[2], x1), Math.max(r[3], y1)] : [x0, y0, x1, y1];
}
