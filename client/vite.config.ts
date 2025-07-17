import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    host: '0.0.0.0'
  },
  optimizeDeps: { exclude: ['zstd-codec'] },
  assetsInclude: ["**/*.wasm"], 
  plugins: [react()],
})
