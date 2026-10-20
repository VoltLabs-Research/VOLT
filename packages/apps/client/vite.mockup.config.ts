import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
    root: path.resolve(__dirname, 'mockups/canvas-minimal'),
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: [
            { find: '@', replacement: path.resolve(__dirname, './src') }
        ]
    },
    build: { outDir: path.resolve(__dirname, 'dist-mockup'), emptyOutDir: true }
});
