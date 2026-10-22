import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';

const alias = {
    '@': resolve('src')
};

// The window loads the web client's own build (packages/apps/client/dist), so there is no renderer here.
export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        resolve: { alias },
        build: {
            outDir: 'out/main',
            lib: { entry: 'src/main.ts' }
        }
    },
    // CommonJS, which runs before the page's own scripts (an ES module preload loads asynchronously,
    // so the client could start before window.volt exists) and is what a sandboxed renderer runs.
    preload: {
        plugins: [externalizeDepsPlugin()],
        resolve: { alias },
        build: {
            outDir: 'out/preload',
            lib: { entry: 'src/preload.ts' },
            rollupOptions: {
                output: {
                    format: 'cjs',
                    entryFileNames: '[name].cjs'
                }
            }
        }
    }
});
