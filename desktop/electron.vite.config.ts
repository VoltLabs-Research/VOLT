import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const alias = {
    '@': resolve('src'),
    // Same alias the server and client use, so desktop consumes the shared wire
    // contracts instead of restating routes and types.
    '@volt/contracts': resolve('../contracts/src')
};

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
        /*
         * Tailwind runs in the renderer only. bravais's primitives emit Tailwind
         * class names, so the utilities they need are generated here rather than
         * shipped precompiled — which is why `styles.css` carries a `@source`
         * pointing at the bravais bundle.
         */
        plugins: [react(), tailwindcss()],
        resolve: { alias },
        build: {
            outDir: 'out/renderer',
            rollupOptions: { input: resolve('src/renderer/index.html') }
        }
    }
});
