import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const isElectronBuild = process.env.VITE_ELECTRON_BUILD === 'true';

const getManualChunk = (id: string) => {
    if (!id.includes('node_modules')) {
        return undefined;
    }

    if (id.includes('monaco-editor') || id.includes('@monaco-editor/react')) {
        return 'monaco';
    }

    if (
        id.includes('/three/') ||
        id.includes('@react-three/fiber') ||
        id.includes('@react-three/drei') ||
        id.includes('@react-three/postprocessing') ||
        id.includes('/postprocessing/')
    ) {
        return 'three';
    }

    if (id.includes('@excalidraw/excalidraw')) {
        return 'excalidraw';
    }

    if (id.includes('/recharts/') || id.includes('@mui/x-charts')) {
        return 'charts';
    }

    if (id.includes('/react-pdf/') || id.includes('/pdfjs-dist/')) {
        return 'pdf';
    }

    if (
        id.includes('/react-markdown/') ||
        id.includes('/remark-gfm/') ||
        id.includes('/xlsx/')
    ) {
        return 'document-tools';
    }

    return undefined;
};

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
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: getManualChunk
                }
            }
        }
    };
});
