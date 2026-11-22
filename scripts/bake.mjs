// Exports every drawn building picture as a PNG (day lighting) into bake/, with bake/index.json (picture size and anchor).
// Use them as templates for hand-made art: draw over one, keep its size and anchor, point a content pack at your PNG.
// Run:  npm run bake      (needs the dev dependency @napi-rs/canvas)
import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
globalThis.document = { createElement: () => createCanvas(1, 1) };
const { buildingSprite, serviceSprite } = await import('../src/game/sprites.js');
const { T } = await import('../src/game/world.js');
const { BT } = await import('../src/game/buildings.js');
const dir = new URL('../bake/', import.meta.url); fs.mkdirSync(dir, { recursive: true });
const index = {}, save = (name, sp) => { fs.writeFileSync(new URL(name + '.png', dir), sp.c.toBuffer('image/png')); index[name] = { w: sp.c.width, h: sp.c.height, scale: sp.S, ox: sp.ox * sp.S, oy: sp.oy * sp.S }; };
for (const [kn, k] of [['res', T.RES], ['com', T.COM], ['ind', T.IND]]) for (let l = 1; l <= 4; l++) for (let v = 0; v < 16; v++) save(`${kn}_${l}_${v}`, buildingSprite(k, l, v, 0, true));
for (const id of Object.keys(BT)) { const sp = serviceSprite(+id, 0, true, 0); if (sp) save(`svc_${BT[id].key}`, sp); }
fs.writeFileSync(new URL('index.json', dir), JSON.stringify(index, null, 1));
console.log('baked', Object.keys(index).length, 'pictures into bake/');
