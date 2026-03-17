import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    const backendTarget = env.VITE_API_URL || 'http://127.0.0.1:8000';

    return {
        base: '/',
        plugins: [react()],
        server: {
            host: '0.0.0.0',
            allowedHosts: ['5173--main--volt-development--rodyherrera--frda5i519n648.pit-1.try.coder.app'],
            port: 5173,
            strictPort: true,
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
        },
        optimizeDeps: {
            include: ['react-icons/tb', 'zod', 'react', 'react-dom']
        },
        build: {}
    };
});
