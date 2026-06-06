import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const alias = { '@': resolve('src') };

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        resolve: { alias },
        build: {
            outDir: 'out/main',
            lib: { entry: 'src/main.ts' }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        resolve: { alias },
        build: {
            outDir: 'out/preload',
            lib: { entry: 'src/preload.ts' }
        }
    },
    renderer: {
        root: resolve('src/renderer'),
        plugins: [react()],
        resolve: { alias },
        build: {
            outDir: 'out/renderer',
            rollupOptions: { input: resolve('src/renderer/index.html') }
        }
    }
});
