import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
const built = new Date().toISOString().slice(0, 16).replace('T', ' ');
export default defineConfig({
  plugins: [react()], base: './', build: { target: 'es2019' },
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_TIME__: JSON.stringify(built) },
});
