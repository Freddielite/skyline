// Tells Android this is a game: the app category lets the phone's game mode / game booster pick it up
// (performance profile, do-not-disturb, its game toolbar), hardware acceleration is switched on explicitly,
// and the screen stays awake while you play. Safe to run repeatedly; does nothing if android/ doesn't exist yet.
import fs from 'node:fs';
import path from 'node:path';

const mf = 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(mf)) { console.log('[game] no android project yet, skipping'); process.exit(0); }
let x = fs.readFileSync(mf, 'utf8');
const addAttr = (tag, attr, val) => {
  const re = new RegExp(`<${tag}(\\s|>)`);
  const m = re.exec(x); if (!m) return;
  const end = x.indexOf('>', m.index), open = x.slice(m.index, end);
  if (open.includes(`android:${attr}=`)) x = x.slice(0, m.index) + open.replace(new RegExp(`android:${attr}="[^"]*"`), `android:${attr}="${val}"`) + x.slice(end);
  else x = x.slice(0, m.index) + `<${tag}\n        android:${attr}="${val}"` + x.slice(m.index + tag.length + 1);
};
addAttr('application', 'appCategory', 'game');
addAttr('application', 'isGame', 'true');
addAttr('application', 'hardwareAccelerated', 'true');
addAttr('activity', 'hardwareAccelerated', 'true');
fs.writeFileSync(mf, x);
console.log('[game] manifest: app category game, hardware acceleration on');

const root = 'android/app/src/main/java';
const find = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => { const p = path.join(dir, e.name); return e.isDirectory() ? find(p) : e.name === 'MainActivity.java' ? [p] : []; }) : [];
const f = find(root)[0];
if (!f) { console.log('[game] MainActivity.java not found, skipping screen-awake'); process.exit(0); }
let src = fs.readFileSync(f, 'utf8');
if (!src.includes('FLAG_KEEP_SCREEN_ON')) {
  if (!src.includes('import android.view.WindowManager;')) src = src.replace(/(package [\w.]+;\s*)/, '$1\nimport android.view.WindowManager;\n');
  src = src.replace('super.onCreate(savedInstanceState);', 'super.onCreate(savedInstanceState);\n    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // games keep the screen awake while playing');
  fs.writeFileSync(f, src);
  console.log('[game] screen stays awake while playing');
} else console.log('[game] screen-awake already set');
