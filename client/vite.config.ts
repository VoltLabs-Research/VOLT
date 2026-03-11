import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const isElectronBuild = process.env.VITE_ELECTRON_BUILD === 'true';

export default defineConfig({
    base: isElectronBuild ? './' : '/',
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 5173
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
});
