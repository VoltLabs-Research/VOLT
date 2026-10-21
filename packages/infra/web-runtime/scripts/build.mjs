#!/usr/bin/env node
// Bundles the backends' built dist into module workers for src/workers/backend.ts: each backend's
// entry point, and each Node program it spawns (the daemon's planes). Node built-ins and native
// packages resolve to src/platform, and to node-stdlib-browser for the built-ins it implements
// faithfully. Native addons the backends depend on are compiled to WebAssembly (scripts/native-addons.mjs).
// `node scripts/build.mjs server` builds only the named backends.
import * as esbuild from 'esbuild';
import stdLibBrowser from 'node-stdlib-browser';
import http2 from 'node:http2';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { buildNativeAddon, isNativeAddon } from './native-addons.mjs';

const require = createRequire(import.meta.url);
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platformDir = path.join(packageDir, 'src', 'platform');
const outDir = path.join(packageDir, 'dist');
// Compiled once per source change, under the conventional cache location node_modules/.cache.
const addonsDir = path.join(packageDir, 'node_modules', '.cache', 'native-addons');

const platform = (file) => path.join(platformDir, file);
const packageRoot = (name) => path.dirname(require.resolve(`${name}/package.json`));

// Where each backend is installed inside its worker's file system, as it is on the desktop.
const BACKENDS = [
    {
        name: 'server',
        root: packageRoot('volt-server'),
        mountPoint: '/app/server',
        entry: 'dist/infra/server/src/server.js',
        programs: []
    },
    {
        name: 'daemon',
        root: packageRoot('cluster-daemon'),
        mountPoint: '/app/daemon',
        entry: 'dist/infra/cluster/src/daemon.js',
        programs: [
            'dist/infra/cluster/src/control-plane.js',
            'dist/infra/cluster/src/heartbeat-plane.js',
            'dist/infra/cluster/src/socket-channel-plane.js',
            'dist/infra/cluster/src/modules/trajectory/workers/parquet-ingest-worker.cjs'
        ]
    }
];

const PLATFORM_MODULES = {
    fs: platform('fs.cjs'),
    'fs/promises': platform('fs-promises.cjs'),
    http: platform('http.cjs'),
    https: platform('http.cjs'),
    crypto: platform('crypto.cjs'),
    async_hooks: platform('async-hooks.cjs'),
    child_process: platform('child-process.cjs'),
    worker_threads: platform('worker-threads.cjs'),
    'stream/promises': platform('stream-promises.ts'),
    'stream/consumers': platform('stream-consumers.ts'),
    process: platform('process.cjs'),
    'util/types': platform('util-types.cjs'),
    net: platform('net.cjs'),
    os: platform('os.cjs'),
    path: platform('path.cjs'),
    perf_hooks: platform('perf-hooks.ts'),
    zlib: platform('zlib.cjs'),
    http2: platform('http2.cjs'),
    timers: platform('timers.cjs')
};

const PACKAGE_MODULES = {
    'better-sqlite3': platform('better-sqlite3.cjs'),
    ws: platform('ws.ts'),
    'app-root-path': platform('app-root-path.cjs'),
    sharp: platform('sharp.cjs'),
    'chartjs-node-canvas': platform('chartjs-node-canvas.cjs'),
    '@duckdb/node-api': platform('duckdb-node-api.ts')
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

// __dirname/__filename of every bundled file, as its path in the installed backend: code that
// locates its own files (plane scripts, static assets) finds them where the desktop has them.
// A native addon's glue is installed where node-gyp-build finds the addon it replaces.
const moduleLocationPlugin = (backend) => ({
    name: 'module-location',
    setup(build){
        build.onLoad({ filter: /\.(c|m)?js$/ }, async (args) => {
            const contents = await readFile(args.path, 'utf8');
            if(!/\b__(dirname|filename)\b/.test(contents)){
                return null;
            }
            const installed = backend.addons.find((addon) => addon.glue === args.path)?.installed
                ?? path.posix.join(backend.mountPoint, path.relative(backend.root, args.path).split(path.sep).join('/'));
            const prelude = `var __filename = ${JSON.stringify(installed)}, __dirname = ${JSON.stringify(path.posix.dirname(installed))};\n`;
            return { contents: prelude + contents, loader: 'js' };
        });
    }
});

// `require('<addon>')` instantiates its WebAssembly build as the Node-API module it is.
const nativeAddonPlugin = (backend) => ({
    name: 'native-addon',
    setup(build){
        const byName = new Map(backend.addons.map((addon) => [addon.packageName, addon]));
        if(byName.size === 0){
            return;
        }
        const filter = new RegExp(`^(${[...byName.keys()].map((name) => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})$`);
        build.onResolve({ filter }, (args) => ({ path: args.path, namespace: 'native-addon' }));
        build.onLoad({ filter: /.*/, namespace: 'native-addon' }, (args) => ({
            contents: [
                "const { getDefaultContext } = require('@emnapi/runtime');",
                `module.exports = require(${JSON.stringify(byName.get(args.path).glue)})().emnapiInit({ context: getDefaultContext() });`
            ].join('\n'),
            resolveDir: packageDir,
            loader: 'js'
        }));
    }
});

// The direct dependencies of a backend that are native addons, other than those src/platform implements.
const nativeAddonsOf = async (backend) => {
    const manifest = JSON.parse(await readFile(path.join(backend.root, 'package.json'), 'utf8'));
    const addons = [];
    for(const packageName of Object.keys(manifest.dependencies ?? {})){
        if(packageName in PACKAGE_MODULES){
            continue;
        }
        const root = path.join(backend.root, 'node_modules', packageName);
        if(!(await isNativeAddon(root))){
            continue;
        }
        const { name, glue } = await buildNativeAddon(root, path.join(addonsDir, packageName));
        addons.push({
            packageName,
            glue,
            installed: path.posix.join(backend.mountPoint, 'node_modules', packageName, 'build', 'Release', `${name}.cjs`)
        });
    }
    return addons;
};

// Every program a backend runs: its entry point, the Node programs it spawns, and the glue of each
// native addon, which its threads start from.
const programsOf = (backend) => [
    { source: path.join(backend.root, backend.entry), installed: path.posix.join(backend.mountPoint, backend.entry), workerFile: `${backend.name}.worker.js` },
    ...[...backend.programs.map((script) => ({ source: path.join(backend.root, script), installed: path.posix.join(backend.mountPoint, script) })),
        ...backend.addons.map((addon) => ({ source: addon.glue, installed: addon.installed }))]
        .map((program) => ({ ...program, workerFile: `${backend.name}-${path.posix.basename(program.installed).replace(/\.c?js$/, '')}.worker.js` }))
];

const buildProgram = async (backend, program) => {
    const nodePrograms = Object.fromEntries(programsOf(backend).slice(1).map((spawned) => [spawned.installed, `./${spawned.workerFile}`]));
    await esbuild.build({
        entryPoints: { [program.workerFile.replace(/\.js$/, '')]: path.join(packageDir, 'src', 'workers', 'backend.ts') },
        outdir: outDir,
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        mainFields: ['browser', 'module', 'main'],
        // esbuild adds 'import' or 'require' itself, matching how each module is loaded.
        conditions: ['browser', 'module'],
        nodePaths: [path.join(backend.root, 'node_modules'), path.join(packageDir, 'node_modules')],
        alias: { ...builtinAliases(), 'volt-backend-entry': program.source },
        inject: [platform('globals.ts')],
        define: {
            // esbuild would otherwise inline its own NODE_ENV for browser builds; the backends read the booted env.
            'process.env.NODE_ENV': 'globalThis.process.env.NODE_ENV',
            VOLT_PROGRAM_PATH: JSON.stringify(program.installed),
            VOLT_NODE_PROGRAMS: JSON.stringify(nodePrograms),
            VOLT_HTTP2_CONSTANTS: JSON.stringify(http2.constants),
            VOLT_HTTP2_DEFAULT_SETTINGS: JSON.stringify(http2.getDefaultSettings())
        },
        plugins: [nativeAddonPlugin(backend), moduleLocationPlugin(backend)],
        // Optional integrations their packages load lazily and VOLT never calls.
        external: ['@aws-sdk/client-s3', 'cpu-features'],
        loader: { '.node': 'empty', '.wasm': 'file' },
        sourcemap: true,
        logLevel: 'warning',
        logLimit: 0
    });
    console.log(`[web-runtime] built ${program.workerFile}`);
};

const requested = process.argv.slice(2);
const selected = requested.length > 0 ? BACKENDS.filter((backend) => requested.includes(backend.name)) : BACKENDS;

await mkdir(outDir, { recursive: true });
await cp(require.resolve('@sqlite.org/sqlite-wasm/sqlite3.wasm'), path.join(outDir, 'sqlite3.wasm'));
for(const file of ['duckdb-mvp.wasm', 'duckdb-eh.wasm']){
    await cp(require.resolve(`@duckdb/duckdb-wasm/dist/${file}`), path.join(outDir, file));
}
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
    backend.addons = await nativeAddonsOf(backend);
    for(const program of programsOf(backend)){
        await buildProgram(backend, program);
    }
}
