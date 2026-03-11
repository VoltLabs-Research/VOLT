import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const isElectronBuild = process.env.VITE_ELECTRON_BUILD === 'true';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    const backendTarget = env.VITE_API_URL || 'http://127.0.0.1:8000';

    return {
        base: isElectronBuild ? './' : '/',
        plugins: [react()],
        server: {
            host: '0.0.0.0',
            port: 5173,
            proxy: {
                '/api': {
                    target: backendTarget,
                    changeOrigin: true,
                    ws: true
                },
                '/socket.io': {
                    target: backendTarget,
                    changeOrigin: true,
                    ws: true
                }
            }
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src')
            }
        }
    };
});
