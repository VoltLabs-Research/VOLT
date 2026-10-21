// Native Node addons, compiled from the sources their packages publish into WebAssembly that
// implements the same Node-API module: emnapi provides Node-API, Emscripten's NODERAWFS the file
// I/O (through the platform's fs) and its pthreads the addon's threads (through worker_threads).
// The compile settings are the package's own binding.gyp, as node-gyp reads them on Linux.
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const emnapiDir = path.dirname(require.resolve('emnapi/package.json'));
const memoryShim = path.join(packageDir, 'src', 'native', 'node-api-memory.js');

const run = promisify(execFile);

// The flags of a gyp target that apply on Linux: its own plus those of its `OS=="linux"` conditions.
const linuxFlags = (target, key) => [
    ...(target[key] ?? []),
    ...(target.conditions ?? [])
        .filter(([condition]) => condition === 'OS=="linux"')
        .flatMap(([, settings]) => settings[key] ?? [])
];

const readTarget = async (root) => {
    const gyp = JSON.parse(await readFile(path.join(root, 'binding.gyp'), 'utf8'));
    if(gyp.targets.length !== 1){
        throw new Error(`${root}/binding.gyp: expected one target, found ${gyp.targets.length}`);
    }
    return gyp.targets[0];
};

const isNewer = async (output, inputs) => {
    try{
        const built = (await stat(output)).mtimeMs;
        const sources = await Promise.all(inputs.map(async (input) => (await stat(input)).mtimeMs));
        return sources.every((mtime) => mtime < built);
    }catch{
        return false;
    }
};

// Whether a package is a native addon this module can build: one with a node-gyp target.
export const isNativeAddon = async (root) => {
    try{
        await stat(path.join(root, 'binding.gyp'));
        return true;
    }catch{
        return false;
    }
};

// Compiles the addon at `root` into `outDir`, and returns its glue: a CommonJS module exporting the
// Emscripten factory, with the wasm embedded. Builds again only when a source is newer.
export const buildNativeAddon = async (root, outDir) => {
    const target = await readTarget(root);
    const name = target.target_name;
    const output = path.join(outDir, `${name}.cjs`);
    const sources = target.sources.map((source) => path.join(root, source));
    if(await isNewer(output, [...sources, memoryShim, path.join(root, 'binding.gyp')])){
        return { name, glue: output };
    }

    const cflags = [...linuxFlags(target, 'cflags'), ...linuxFlags(target, 'cflags_cc')];
    const threads = cflags.includes('-pthread');
    const args = [
        ...new Set(cflags),
        '-fexceptions',
        '-DBUILDING_NODE_EXTENSION',
        `-DNODE_GYP_MODULE_NAME=${name}`,
        ...(target.defines ?? []).map((define) => `-D${define}`),
        ...(target.include_dirs ?? []).map((dir) => `-I${path.join(root, dir)}`),
        `-I${path.join(emnapiDir, 'include', 'node')}`,
        `-L${path.join(emnapiDir, 'lib', 'wasm32-emscripten')}`,
        `--js-library=${path.join(emnapiDir, 'dist', 'library_napi.js')}`,
        `--pre-js=${memoryShim}`,
        '-sEXPORTED_FUNCTIONS=["_malloc","_free","_napi_register_wasm_v1","_node_api_module_get_api_version_v1"]',
        '-sEXPORTED_RUNTIME_METHODS=["emnapiInit"]',
        // A Node program: `require()` loads it synchronously, and its files are the process's.
        '-sENVIRONMENT=node',
        '-sNODERAWFS=1',
        '-sMODULARIZE=1',
        '-sWASM_ASYNC_COMPILATION=0',
        '-sSINGLE_FILE=1',
        '-sALLOW_MEMORY_GROWTH=1',
        '-sMAXIMUM_MEMORY=4GB',
        ...(threads ? ['-Wno-pthreads-mem-growth'] : []),
        '-o', output,
        ...sources,
        threads ? '-lemnapi-mt' : '-lemnapi'
    ];
    await mkdir(outDir, { recursive: true });
    try{
        await run('em++', args, { maxBuffer: 64 * 1024 * 1024 });
    }catch(error){
        if(error.code === 'ENOENT'){
            throw new Error('em++ not found: native addons are compiled with Emscripten (source emsdk_env.sh first)');
        }
        throw new Error(`em++ failed for ${name}:\n${error.stderr}`);
    }
    console.log(`[web-runtime] compiled native addon ${name}`);
    return { name, glue: output };
};
