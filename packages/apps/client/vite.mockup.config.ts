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
            { find: '@volt/contracts', replacement: path.resolve(__dirname, '../contracts/src') },
            { find: '@', replacement: path.resolve(__dirname, './src') }
        ]
    },
    server: { fs: { allow: [path.resolve(__dirname, '..')] } },
    build: { outDir: path.resolve(__dirname, 'dist-mockup'), emptyOutDir: true }
});
