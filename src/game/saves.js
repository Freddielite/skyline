// Save storage: IndexedDB (no 5 MB cap, unlike localStorage), three slots plus three rolling auto-backups.
// Everything is read into memory once at start (initSaves), so the game can keep reading and writing saves synchronously;
// writes go to the database in the background. If IndexedDB is unavailable, slot 1 falls back to localStorage.
const DB = 'skyline', STORE = 'saves', LEGACY = 'skyline.save.v1', SLOT_PREF = 'skyline.slot';
export const SLOTS = ['slot1', 'slot2', 'slot3'];
export const BACKUPS = ['auto1', 'auto2', 'auto3'];
const BACKUP_EVERY = 10 * 60 * 1000;
const cache = new Map();
let db = null;

const open = () => new Promise((ok) => {
  try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' }); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); r.onblocked = () => ok(null); } catch (e) { ok(null); }
});
const persist = (rec) => new Promise((ok) => {
  if (!db) { try { if (rec.key === 'slot1') localStorage.setItem(LEGACY, rec.data); ok(true); } catch (e) { ok(false); } return; }
  try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(rec); tx.oncomplete = () => ok(true); tx.onerror = tx.onabort = () => ok(false); } catch (e) { ok(false); }
});
const unpersist = (key) => new Promise((ok) => {
  if (!db) { ok(true); return; }
  try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => ok(true); tx.onerror = tx.onabort = () => ok(false); } catch (e) { ok(false); }
});

export async function initSaves() {
  db = await open();
  if (db) await new Promise((ok) => { try { const q = db.transaction(STORE).objectStore(STORE).getAll(); q.onsuccess = () => { for (const r of q.result) cache.set(r.key, r); ok(); }; q.onerror = () => ok(); } catch (e) { ok(); } });
  try {                                                  // the old single save in localStorage moves into slot 1, then is removed once the copy is safe
    const raw = localStorage.getItem(LEGACY);
    if (raw && !cache.has('slot1')) {
      const o = JSON.parse(raw), rec = { key: 'slot1', ts: Date.now(), pop: o.sim.peakPop || 0, money: o.sim.money || 0, date: '', data: raw };
      cache.set('slot1', rec);
      if (db && (await persist(rec))) localStorage.removeItem(LEGACY);
    }
  } catch (e) { /* ignore a broken old save */ }
}
export const available = () => !!db;
export const get = (key) => cache.get(key);
export const meta = (key) => { const r = cache.get(key); return r ? { key, ts: r.ts, pop: r.pop, money: r.money, date: r.date, sandbox: !!r.sandbox } : null; };
export function put(key, data, info = {}) {
  const rec = { key, ts: Date.now(), pop: info.pop || 0, money: info.money || 0, date: info.date || '', sandbox: !!info.sandbox, data };
  cache.set(key, rec); return persist(rec);
}
export function remove(key) { cache.delete(key); return unpersist(key); }
// The slot to continue: the one last used, else the newest, else slot 1.
export function currentSlot() {
  try { const k = localStorage.getItem(SLOT_PREF); if (k && cache.has(k) && SLOTS.includes(k)) return k; } catch (e) { /* ignore */ }
  let best = null; for (const k of SLOTS) { const r = cache.get(k); if (r && (!best || r.ts > best.ts)) best = r; }
  return best ? best.key : 'slot1';
}
export function rememberSlot(key) { try { localStorage.setItem(SLOT_PREF, key); } catch (e) { /* ignore */ } }
export const firstEmptySlot = () => SLOTS.find((k) => !cache.has(k)) || null;
// Every 10 minutes the save being written is also copied into a rolling backup (newest is auto1).
export function backup(rec, force) {
  const a1 = cache.get('auto1');
  if (!force && a1 && Date.now() - a1.ts < BACKUP_EVERY) return;
  const cur = cache.get(rec);
  if (!cur || (cur.pop < 20 && !force)) return;
  for (let i = BACKUPS.length - 1; i > 0; i--) { const from = cache.get(BACKUPS[i - 1]); if (from) { const r = { ...from, key: BACKUPS[i] }; cache.set(r.key, r); persist(r); } }
  const r = { ...cur, key: 'auto1', ts: Date.now() }; cache.set('auto1', r); persist(r);
}

// Hand the save to the player as a file: the phone's share sheet (Drive, messages, files), else a download.
export async function exportSave(key) {
  const r = cache.get(key); if (!r) return false;
  const name = `skyline-${key}-${new Date(r.ts).toISOString().slice(0, 10)}.json`;
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem'), { Share } = await import('@capacitor/share');
    const w = await Filesystem.writeFile({ path: name, data: r.data, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: w.uri }); return true;
  } catch (e) { /* not on a phone, or sharing was cancelled: try the browser way */ }
  try {
    const blob = new Blob([r.data], { type: 'application/json' }), file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); return true;
  } catch (e) { return false; }
}
// Put a save file's text into a slot, after checking it really is a Skyline city.
export async function importSave(text, key) {
  let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, why: 'That file is not a Skyline save' }; }
  if (!o || !o.world || !o.sim || !o.world.terrain) return { ok: false, why: 'That file is not a Skyline save' };
  const ok = await put(key, text, { pop: o.sim.peakPop || 0, money: o.sim.money || 0, date: '', sandbox: !!o.sim.sandbox });
  return ok ? { ok: true } : { ok: false, why: 'Could not store the save' };
}
