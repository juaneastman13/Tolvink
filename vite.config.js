import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Plugin: stamp SW with unique build hash so each deploy busts the old cache
function swVersion() {
  return {
    name: 'sw-version',
    writeBundle() {
      const swPath = path.resolve('dist/sw.js');
      if (!fs.existsSync(swPath)) return;
      let sw = fs.readFileSync(swPath, 'utf-8');
      const hash = Date.now().toString(36);
      sw = sw.replace("'tolvink-v4.2'", `'tolvink-${hash}'`);
      fs.writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersion()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
})
