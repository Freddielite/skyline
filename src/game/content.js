// Content packs: add buildings and pictures with files only, no code.
//   public/content/pack.json lists them; every picture is a PNG next to it. See "Adding content" in README.md.
// Loaded once at start (before the interface draws). A missing or broken pack is skipped, so the game never fails to start.
import { BT, BY_KEY } from './buildings.js';
import { UNLOCK } from './rules.js';
import { SVC_H } from './construction.js';
import { T } from './world.js';
import { registerSprite, registerPool } from './sprites.js';
import { TOOL_COST } from './game.js';

const KINDS = { res: T.RES, com: T.COM, ind: T.IND };
export const EXTRA_TOOLS = [];      // { id, label, icon, cost, cat } for the build menu (App.jsx adds them)
let uid = 0;

const loadImage = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('picture missing: ' + src)); i.src = src; });

// ox/oy: where the footprint's back corner sits in the picture (picture pixels). Default: footprint centred, resting on the picture's bottom edge.
async function picture(base, p, w, d) {
  const img = await loadImage(base + p.file), S = p.scale || 2, lw = img.width / S, lh = img.height / S;
  return { img, S, id: ++uid, ox: p.ox != null ? p.ox / S : d * 32 + (lw - (w + d) * 32) / 2, oy: p.oy != null ? p.oy / S : lh - (w + d) * 16 };
}

export async function loadContent(base = './content/') {
  let pack; try { const r = await fetch(base + 'pack.json'); if (!r.ok) return; pack = await r.json(); } catch (e) { return; }
  for (const b of pack.buildings || []) {
    try {
      if (!b.id || b.id < 100 || b.id > 250 || BT[b.id] || BY_KEY[b.key]) throw new Error('bad or taken id/key');
      const def = { id: b.id, key: b.key, name: b.name, w: b.w || 1, d: b.d || 1, cost: b.cost || 500, upkeep: b.upkeep || 0, cat: b.cat || 'fun' };
      for (const f of ['radius', 'use', 'power', 'water', 'waste', 'pollute', 'pr', 'cov', 'road']) if (b[f] != null) def[f] = b[f];
      registerSprite('s' + b.id, await picture(base, b.sprite, def.w, def.d));
      BT[b.id] = def; BY_KEY[def.key] = def; TOOL_COST[def.key] = def.cost; SVC_H[def.key] = b.height || 50;
      if (b.unlock) UNLOCK[def.key] = b.unlock;
      EXTRA_TOOLS.push({ id: def.key, label: b.label || def.name, icon: b.icon || 'ball', cost: def.cost, cat: def.cat });
    } catch (e) { console.warn('content: building skipped', b && b.key, e.message); }
  }
  for (const [name, list] of Object.entries(pack.looks || {})) {        // "res.2": [ {file}, ... ] = more looks for residential level 2
    try {
      const [k, lv] = name.split('.'), kind = KINDS[k], level = +lv;
      if (!kind || !(level >= 1 && level <= 4)) throw new Error('use res|com|ind . 1-4');
      registerPool(kind, level, await Promise.all(list.map((p) => picture(base, p, 1, 1))));
    } catch (e) { console.warn('content: looks skipped', name, e.message); }
  }
  for (const [id, p] of Object.entries(pack.replace || {})) {           // "4": {file} = replace the drawn picture of building 4
    try { const def = BT[+id]; if (!def) throw new Error('no such building'); registerSprite('s' + id, await picture(base, p, def.w, def.d)); } catch (e) { console.warn('content: replace skipped', id, e.message); }
  }
}
