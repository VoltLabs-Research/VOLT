#!/usr/bin/env node
// Bundles each backend's built dist into a module worker for src/workers/backend.ts, resolving the
// Node built-ins and native packages they import to src/platform (and node-stdlib-browser for the
// built-ins that have a faithful browser implementation already).
import * as esbuild from 'esbuild';
import stdLibBrowser from 'node-stdlib-browser';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platformDir = path.join(packageDir, 'src', 'platform');
const outDir = path.join(packageDir, 'dist');

const platform = (file) => path.join(platformDir, file);

const BACKENDS = [
    {
        name: 'server',
        entry: path.dirname(require.resolve('volt-server/package.json')) + '/dist/infra/server/src/server.js'
    },
    {
        name: 'daemon',
        entry: path.dirname(require.resolve('cluster-daemon/package.json')) + '/dist/infra/cluster/src/daemon.js'
    }
];

const PLATFORM_MODULES = {
    fs: platform('fs.cjs'),
    'fs/promises': platform('fs-promises.cjs'),
    http: platform('http.cjs'),
    https: platform('http.cjs'),
    crypto: platform('crypto.cjs'),
    async_hooks: platform('async-hooks.cjs'),
    'stream/promises': platform('stream-promises.ts'),
    'stream/consumers': platform('stream-consumers.ts'),
    process: platform('process.cjs'),
    'util/types': platform('util-types.cjs'),
    net: platform('net.cjs')
};

const PACKAGE_MODULES = {
    'better-sqlite3': platform('better-sqlite3.cjs'),
    ws: platform('ws.ts'),
    'app-root-path': platform('app-root-path.cjs'),
    sharp: platform('sharp.cjs')
};

const builtinAliases = () => {
    const aliases = {};
    for(const [name, target] of Object.entries(stdLibBrowser)){
        if(!name.startsWith('node:') && target){
            aliases[name] = target;
        }
    }
    Object.assign(aliases, PLATFORM_MODULES);
    for(const [name, target] of Object.entries({ ...aliases })){
        aliases[`node:${name}`] = target;
    }
    return { ...aliases, ...PACKAGE_MODULES };
};

const buildBackend = async (backend) => {
    const backendDir = path.dirname(path.dirname(path.dirname(path.dirname(backend.entry))));
    await esbuild.build({
        entryPoints: { [`${backend.name}.worker`]: path.join(packageDir, 'src', 'workers', 'backend.ts') },
        outdir: outDir,
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        mainFields: ['browser', 'module', 'main'],
        // esbuild adds 'import' or 'require' itself, matching how each module is loaded.
        conditions: ['browser', 'module'],
        nodePaths: [path.join(backendDir, 'node_modules'), path.join(packageDir, 'node_modules')],
        alias: { ...builtinAliases(), 'volt-backend-entry': backend.entry },
        inject: [platform('globals.ts')],
        define: {
            // esbuild would otherwise inline its own NODE_ENV for browser builds; the backends read the booted env.
            'process.env.NODE_ENV': 'globalThis.process.env.NODE_ENV',
            VOLT_BACKEND_NAME: JSON.stringify(backend.name),
            __dirname: JSON.stringify(`/app/${backend.name}`),
            __filename: JSON.stringify(`/app/${backend.name}/index.js`)
        },
        // Optional integrations their packages load lazily and VOLT never calls.
        external: ['@aws-sdk/client-s3'],
        loader: { '.node': 'empty', '.wasm': 'file' },
        sourcemap: true,
        logLevel: 'warning',
        logLimit: 0
    });
};

// `node scripts/build.mjs server` builds only the named backends.
const requested = process.argv.slice(2);
const selected = requested.length > 0 ? BACKENDS.filter((backend) => requested.includes(backend.name)) : BACKENDS;

await mkdir(outDir, { recursive: true });
await cp(require.resolve('@sqlite.org/sqlite-wasm/sqlite3.wasm'), path.join(outDir, 'sqlite3.wasm'));
await esbuild.build({
    entryPoints: { 'fs.worker': path.join(platformDir, 'fs', 'service.ts') },
    outdir: outDir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'warning'
});
for(const backend of selected){
    await buildBackend(backend);
    console.log(`[web-runtime] built ${backend.name}.worker.js`);
}
