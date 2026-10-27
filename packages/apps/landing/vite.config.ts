import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5180,
        strictPort: true
    },
    resolve: {
        alias: [
            {
                find: '@',
                replacement: path.resolve(__dirname, './src')
            }
        ]
    }
});
