// Makes the Android app truly fullscreen: hides status + navigation bars (swipe from an edge to peek them)
// and draws into the camera cutout. Safe to run repeatedly; does nothing if android/ doesn't exist yet.
import fs from 'node:fs';
import path from 'node:path';

const root = 'android/app/src/main/java';
if (!fs.existsSync(root)) { console.log('[fullscreen] no android project yet, skipping'); process.exit(0); }

const find = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? find(p) : e.name === 'MainActivity.java' ? [p] : [];
});
const files = find(root);
if (!files.length) { console.log('[fullscreen] MainActivity.java not found, skipping'); process.exit(0); }

const f = files[0];
const src = fs.readFileSync(f, 'utf8');
if (src.includes('goImmersive')) { console.log('[fullscreen] already patched'); process.exit(0); }
const pkg = (src.match(/^\s*package\s+([\w.]+)\s*;/m) || [])[1] || 'com.wyntek.skyline';

fs.writeFileSync(f, `package ${pkg};

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    goImmersive();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) goImmersive();
  }

  // Edge-to-edge, system bars hidden, content allowed behind the camera cutout.
  private void goImmersive() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      WindowManager.LayoutParams lp = getWindow().getAttributes();
      lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
          ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
          : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      getWindow().setAttributes(lp);
    }
    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    c.hide(WindowInsetsCompat.Type.systemBars());
  }
}
`);
console.log('[fullscreen] patched ' + f);
