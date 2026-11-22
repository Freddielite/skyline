// Draws the example building in public/content (a corner cafe) so the content-pack pipeline has something to load.
// Run:  node tools/make-sample-pack.mjs   (needs the dev dependency @napi-rs/canvas)
import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
const S = 2, W = 160, H = 110, c = createCanvas(W * S, H * S), g = c.getContext('2d'); g.scale(S, S);
const P = (x, y, z = 0) => [80 + (x - y) * 32, 78 + (x + y) * 16 - z];
const poly = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.7; g.stroke(); };
poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], '#cfd1d4');                                   // pavement lot
const x0 = 0.1, y0 = 0.1, x1 = 0.9, y1 = 0.78, h = 30;
poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)], '#efe2c6');                // front wall (left face)
poly([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)], '#cdbd9f');                // side wall (right face)
poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], '#8a8f98');                // flat roof
poly([P(x0 + 0.06, y1, 3), P(x1 - 0.06, y1, 3), P(x1 - 0.06, y1, 17), P(x0 + 0.06, y1, 17)], '#35566b');   // shop window
for (let i = 0; i < 8; i++) { const a = x0 + (x1 - x0) * i / 8, b = x0 + (x1 - x0) * (i + 1) / 8; poly([P(a, y1, 24), P(b, y1, 24), P(b, y1 + 0.12, 18), P(a, y1 + 0.12, 18)], i % 2 ? '#f4f0e6' : '#c8453a'); }   // striped awning
for (const [tx, ty] of [[0.25, 0.9], [0.55, 0.92], [0.8, 0.88]]) { const p = P(tx, ty, 6); g.fillStyle = '#7a5a3a'; g.beginPath(); g.ellipse(p[0], p[1], 3.2, 1.6, 0, 0, 7); g.fill(); g.fillStyle = '#e8e2d4'; g.fillRect(p[0] - 0.6, p[1], 1.2, 5); }   // tables
const p = P(0.7, 0.3, h); g.fillStyle = '#e04848'; g.fillRect(p[0] - 5, p[1] - 9, 10, 4);  // little sign on the roof
fs.writeFileSync(new URL('../public/content/cafe.png', import.meta.url), c.toBuffer('image/png'));
fs.writeFileSync(new URL('../public/content/pack.json', import.meta.url), JSON.stringify({
  _readme: 'Content pack: see "Adding content" in README.md. ids 100-250 are free for packs.',
  buildings: [{ id: 100, key: 'cafe', name: 'Corner cafe', label: 'Cafe', icon: 'book', cat: 'fun', w: 1, d: 1, cost: 650, upkeep: 14, radius: 7, use: 1, cov: [['fun', 0.55]], height: 36, unlock: 300, sprite: { file: 'cafe.png', scale: 2 } }],
  looks: {}, replace: {},
}, null, 2));
console.log('sample pack written');
