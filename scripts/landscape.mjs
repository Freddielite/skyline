// Locks the Android app to landscape. Safe to run repeatedly; does nothing if android/ doesn't exist yet.
import fs from 'node:fs';
const f = 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(f)) { console.log('[landscape] no android project yet, skipping'); process.exit(0); }
let x = fs.readFileSync(f, 'utf8');
if (/android:screenOrientation=/.test(x)) { x = x.replace(/android:screenOrientation="[^"]*"/, 'android:screenOrientation="sensorLandscape"'); }
else { x = x.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"'); }
fs.writeFileSync(f, x);
console.log('[landscape] manifest set to sensorLandscape');
