import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

/*
 * ─── TRANSITIONAL BRAVAIS LINK ───────────────────────────────────────────────
 *
 * bravais is being removed in favour of HeroUI. Until the last module is
 * migrated it stays resolvable, so a half-migrated tree still typechecks and
 * builds and each module's gate means something. It resolves to the sibling
 * checkout (1.0.5) rather than to node_modules, where npm installs the older
 * published 1.0.3 — the two are not interchangeable: 1.0.3 still ships
 * `general.css`, whose `p-1` is 1rem against Tailwind's 0.25rem.
 *
 * Delete this block, the dependency, and `resolve.dedupe`'s bravais peers once
 * `grep -r '@voltstack/bravais' src` is empty.
 */
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
            /*
             * Everything the aliased bravais dist imports must resolve from the
             * client's node_modules: inside the Docker build the sibling checkout
             * arrives as a bare dist with no node_modules of its own, so without
             * dedupe Rollup fails on `lucide-react` the moment it enters
             * /bravais/dist/index.js. Locally this also stops the bundle from
             * carrying two copies of each peer.
             */
            dedupe: [
                'react',
                'react-dom',
                'react-router',
                'react-router-dom',
                'lucide-react',
                'framer-motion',
                '@floating-ui/react',
                'react-hotkeys-hook',
                'recharts'
            ]
        },
        optimizeDeps: {
            include: ['zod']
        }
    };
});
