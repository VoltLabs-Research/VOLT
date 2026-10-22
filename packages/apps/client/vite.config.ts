import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import voltWebRuntime from '@volt/web-runtime/vite';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    const backendTarget = env.VITE_PROXY_API_URL || env.VITE_SERVER_ENDPOINT || 'http://127.0.0.1:8000';
    // Trusted certs from scripts/dev-certs.sh (service workers reject self-signed ones); basic-ssl otherwise.
    const certDir = path.resolve(__dirname, '.certs');
    const devCerts = fs.existsSync(path.join(certDir, 'cert.pem'))
        ? { cert: fs.readFileSync(path.join(certDir, 'cert.pem')), key: fs.readFileSync(path.join(certDir, 'key.pem')) }
        : null;

    return {
        base: '/',
        plugins: [react(), tailwindcss(), voltWebRuntime(), ...(devCerts ? [] : [basicSsl()])],
        server: {
            host: '0.0.0.0',
            ...(devCerts ? { https: devCerts } : {}),
            allowedHosts: ['5173--main--volt-development--rodyherrera--frda5i519n648.pit-1.try.coder.app'],
            port: 5170,
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
            alias: [
                {
                    find: '@',
                    replacement: path.resolve(__dirname, './src')
                }
            ],
            dedupe: [
                'react',
                'react-dom',
                'react-router-dom',
                'lucide-react',
                'framer-motion',
                '@floating-ui/react',
                'recharts'
            ]
        },
        optimizeDeps: {
            include: ['zod']
        },
        build: {
            rollupOptions: {
                // The landing's screens are documents of their own (see src/app/screen.tsx).
                input: {
                    main: path.resolve(__dirname, 'index.html'),
                    screen: path.resolve(__dirname, 'landing-screen.html')
                }
            }
        }
    };
});
