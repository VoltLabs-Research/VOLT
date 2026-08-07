import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from './.local-deps/node_modules/@tailwindcss/vite/dist/index.mjs';
import path from 'node:path';

/*
 * ─── TEMPORARY LOCAL LINK ────────────────────────────────────────────────────
 *
 * Everything in this block exists because `node_modules` here is owned by root,
 * so npm cannot write to it — install and `npm link` both fail with EACCES on
 * rename. Tailwind and bravais are therefore resolved out of band: Tailwind from
 * a side prefix at `.local-deps` (which npm *can* write), bravais from the
 * sibling checkout.
 *
 * To undo, once `sudo chown -R $USER:$USER node_modules` has been run and
 * bravais >= 1.0.5 is published:
 *
 *   npm i @voltstack/bravais@^1.0.5
 *   npm i -D tailwindcss@^4 @tailwindcss/vite@^4
 *   rm -rf .local-deps
 *
 * then change the import above to '@tailwindcss/vite' and delete LOCAL_LINK
 * below along with its spread into `resolve.alias`.
 */
const LOCAL_DEPS = path.resolve(__dirname, '.local-deps/node_modules');
const BRAVAIS_DIST = path.resolve(__dirname, '../../bravais/dist');

/*
 * Subpath exports do not follow from a bare package alias, so each entry is
 * listed explicitly and the specific ones come first — Vite matches a string
 * `find` against the whole specifier or its leading path segment, in order.
 */
const LOCAL_LINK = [
    /*
     * Regexes rather than plain strings, and `$1` to carry the query through:
     * `ThemeCard` imports `styles.css?raw` to parse the theme token blocks, and a
     * string `find` matches only the bare specifier or a `/`-prefixed subpath —
     * `?raw` is neither, so it fell through to the bare package alias and
     * resolved to `dist/index.js/styles.css`.
     */
    {
        find: /^@voltstack\/bravais\/tailwind\.css(\?.*)?$/,
        replacement: path.join(BRAVAIS_DIST, 'tailwind.css') + '$1'
    },
    {
        find: /^@voltstack\/bravais\/components\.css(\?.*)?$/,
        replacement: path.join(BRAVAIS_DIST, 'index.css') + '$1'
    },
    {
        find: /^@voltstack\/bravais\/styles\.css(\?.*)?$/,
        replacement: path.join(BRAVAIS_DIST, 'styles.css') + '$1'
    },
    {
        find: '@voltstack/bravais',
        replacement: path.join(BRAVAIS_DIST, 'index.js')
    },
    // Tailwind's own entrypoints, imported by `tailwind.css`.
    {
        find: 'tailwindcss/theme.css',
        replacement: path.join(LOCAL_DEPS, 'tailwindcss/theme.css')
    },
    {
        find: 'tailwindcss/utilities.css',
        replacement: path.join(LOCAL_DEPS, 'tailwindcss/utilities.css')
    }
];

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    const backendTarget = env.VITE_PROXY_API_URL || env.VITE_SERVER_ENDPOINT || 'http://127.0.0.1:8000';

    return {
        base: '/',
        plugins: [react(), tailwindcss()],
        server: {
            host: '0.0.0.0',
            allowedHosts: ['5173--main--volt-development--rodyherrera--frda5i519n648.pit-1.try.coder.app'],
            port: 5173,
            strictPort: true,
            // Allow importing the sibling @volt/contracts raw source (outside
            // client/), and — while bravais is aliased rather than installed —
            // its dist as well.
            fs: {
                allow: [
                    path.resolve(__dirname, '..'),
                    path.resolve(__dirname, '../../bravais')
                ]
            },
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
                ...LOCAL_LINK,
                {
                    find: '@volt/contracts',
                    replacement: path.resolve(__dirname, '../contracts/src')
                },
                {
                    find: '@',
                    replacement: path.resolve(__dirname, './src')
                }
            ],
            dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom']
        },
        optimizeDeps: {
            include: ['zod']
        }
    };
});
