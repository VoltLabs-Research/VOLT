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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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
        vendor: [],
        globalPackages: [],
        programs: []
    },
    {
        name: 'daemon',
        root: packageRoot('cluster-daemon'),
        mountPoint: '/app/daemon',
        entry: 'dist/infra/cluster/src/daemon.js',
        // The tools of its vendor/, which its fetch scripts install on a native machine.
        vendor: ['volt-dump-transform', 'zstd'],
        // The analysis plugins it runs keep their tables in DuckDB.
        globalPackages: ['@duckdb/duckdb-wasm'],
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

const buildProgram = async (backend, program, installs = []) => {
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
            VOLT_INSTALLS: JSON.stringify(installs),
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
// What a backend's machine has installed besides it (src/platform/installs.ts): directories of dist,
// each with the install.json that says where it goes and what it holds.
const writeInstall = async (source, target) => {
    const directory = path.join(outDir, source);
    const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name !== 'install.json')
        .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
        .sort();
    const digest = createHash('sha256');
    for(const file of files){
        digest.update(file).update(await readFile(path.join(directory, file)));
    }
    await writeFile(path.join(directory, 'install.json'), JSON.stringify({ target, files, version: digest.digest('hex') }));
    return source;
};

// The global folder Node's require searches for the runtime's /usr/local/bin/node: $PREFIX/lib/node.
const GLOBAL_MODULES = '/usr/local/lib/node';
// Each global npm package: its files, its CommonJS entry bundled with its dependencies, so that it
// loads without a node_modules tree.
const GLOBAL_PACKAGES = {
    '@duckdb/duckdb-wasm': { entry: 'dist/duckdb-node-blocking.cjs', files: ['dist/duckdb-mvp.wasm', 'dist/duckdb-eh.wasm', 'package.json'] }
};
const installGlobalPackage = async (name) => {
    const { entry, files } = GLOBAL_PACKAGES[name];
    // The package root, from the entry: packages with "exports" need not export their package.json.
    const root = require.resolve(`${name}/${entry}`).slice(0, -entry.length - 1);
    const source = `node/${name}`;
    const target = path.join(outDir, source);
    await rm(target, { recursive: true, force: true });
    for(const file of files){
        await mkdir(path.dirname(path.join(target, file)), { recursive: true });
        await cp(path.join(root, file), path.join(target, file));
    }
    await esbuild.build({
        entryPoints: [path.join(root, entry)],
        outfile: path.join(target, entry),
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'es2022',
        // ws's optional native accelerators, which it loads only when installed.
        external: ['bufferutil', 'utf-8-validate'],
        logLevel: 'warning'
    });
    return writeInstall(source, path.posix.join(GLOBAL_MODULES, name));
};

// A tool of a backend's vendor/: the wasm-wasm32 build of the CoreToolkit release the daemon pins,
// installed by the daemon's own script, or, for a local CoreToolkit build, the programs in
// VOLT_WASM_TOOLS_DIR (the install prefix of CoreToolkit's scripts/build-wasm-plugin.sh, run without a
// plugin). Resolves null when there is neither, as a native machine goes without a tool its release lacks.
const { installCoreToolkitTool } = await import(pathToFileURL(path.join(packageRoot('cluster-daemon'), 'scripts', 'coretoolkit-tool.mjs')).href);
const installVendorTool = async (backend, tool) => {
    const source = `${backend.name}/vendor/${tool}`;
    const target = path.join(outDir, source);
    await rm(target, { recursive: true, force: true });
    const local = process.env.VOLT_WASM_TOOLS_DIR;
    if(local){
        await mkdir(path.join(target, 'bin'), { recursive: true });
        await cp(path.join(local, 'bin', tool), path.join(target, 'bin', tool));
    }else{
        const vendorDir = path.join(packageDir, 'node_modules', '.cache', 'vendor', tool);
        const log = (line) => console.log(`[web-runtime] ${tool}: ${line}`);
        if(!(await installCoreToolkitTool({ tool, platform: 'wasm-wasm32', vendorDir, log }))){
            console.warn(`[web-runtime] no wasm-wasm32 build of ${tool} is published; set VOLT_WASM_TOOLS_DIR to a local CoreToolkit wasm build`);
            return null;
        }
        await cp(path.join(vendorDir, 'bin'), path.join(target, 'bin'), { recursive: true });
    }
    return writeInstall(source, path.posix.join(backend.mountPoint, 'vendor', tool));
};

// A classic script: module service workers are not supported by every browser.
await esbuild.build({
    entryPoints: { 'service-worker': path.join(packageDir, 'src', 'service-worker.ts') },
    outdir: outDir,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'warning'
});
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
// The worker that runs any Node program of a backend's file system (src/workers/node-runner.ts): the
// platform alone, which every backend spawns its programs with.
const RUNNER = { name: 'node-runner', root: packageDir, mountPoint: '/usr/local/lib/node-runner', entry: 'src/workers/node-runner.ts', programs: [], addons: [] };
await buildProgram(RUNNER, { source: path.join(packageDir, RUNNER.entry), installed: path.posix.join(RUNNER.mountPoint, RUNNER.entry), workerFile: 'node-runner.worker.js' });

for(const backend of selected){
    backend.addons = await nativeAddonsOf(backend);
    const installs = [];
    for(const name of backend.globalPackages){
        installs.push(await installGlobalPackage(name));
    }
    for(const tool of backend.vendor){
        installs.push(await installVendorTool(backend, tool));
    }
    // Its entry point installs them; the programs it spawns find them installed.
    const [entry, ...programs] = programsOf(backend);
    await buildProgram(backend, entry, installs.filter(Boolean));
    for(const program of programs){
        await buildProgram(backend, program);
    }
}
