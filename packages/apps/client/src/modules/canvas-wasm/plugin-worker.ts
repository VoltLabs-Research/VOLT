import type { PluginInputFile } from './run-pipeline';

// Runs a single Emscripten plugin build (MODULARIZE=0, see coretoolkit/cmake/VoltPlugin.cmake), then is discarded.
export interface PluginWorkerRequest {
    scriptUrl: string;
    wasmUrl: string;
    args: string[];
    // MEMFS path -> contents written before the plugin starts.
    files: Record<string, PluginInputFile>;
    // Read-only plugin data fetched into MEMFS.
    dataFiles: Array<{ url: string; path: string }>;
    outputDirectory: string;
}

export type PluginWorkerMessage =
    | { type: 'log'; line: string }
    | { type: 'done'; exitCode: number; outputs: Record<string, string> }
    | { type: 'error'; message: string };

interface EmscriptenModule {
    callMain: (args: string[]) => number;
    FS: {
        mkdirTree: (path: string) => void;
        writeFile: (path: string, data: string | Uint8Array) => void;
        readdir: (path: string) => string[];
        readFile: (path: string, options: { encoding: 'utf8' }) => string;
    };
}

type PluginGlobals = typeof globalThis & {
    Module?: Record<string, unknown>;
    HEAPU8?: Uint8Array;
    HEAPU32?: Uint32Array;
};

const scope = globalThis as PluginGlobals;
const post = (message: PluginWorkerMessage) => self.postMessage(message);

const dirname = (path: string): string => path.slice(0, path.lastIndexOf('/')) || '/';

// Uncaught C++ exceptions surface as a pointer to the thrown object. For std::exception subclasses
// (libc++, wasm32) the message pointer follows the vtable pointer.
const describeThrown = (error: unknown): string => {
    if (typeof error !== 'number' || !scope.HEAPU8 || !scope.HEAPU32) {
        return error instanceof Error ? error.message : String(error);
    }
    let pointer = scope.HEAPU32[(error + 4) >>> 2] ?? 0;
    let message = '';
    while (pointer > 0 && pointer < scope.HEAPU8.length && scope.HEAPU8[pointer] >= 32 && message.length < 500) {
        message += String.fromCharCode(scope.HEAPU8[pointer]);
        pointer += 1;
    }
    return message ? `Uncaught exception: ${message}` : 'The plugin aborted with an uncaught C++ exception.';
};

const loadPlugin = async (scriptUrl: string, wasmUrl: string): Promise<EmscriptenModule> => {
    const ready = new Promise<EmscriptenModule>((resolve, reject) => {
        scope.Module = {
            noInitialRun: true,
            locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : new URL(path, scriptUrl).href),
            print: (line: string) => post({ type: 'log', line }),
            printErr: (line: string) => post({ type: 'log', line }),
            onRuntimeInitialized: () => resolve(scope.Module as unknown as EmscriptenModule),
            onAbort: (reason: unknown) => reject(new Error(`Plugin aborted: ${String(reason)}`))
        };
    });

    const response = await fetch(scriptUrl);
    if (!response.ok) {
        throw new Error(`Failed to load ${scriptUrl} (${response.status})`);
    }
    // The glue is a classic script that assigns the global `Module`; evaluate it in global scope.
    (0, eval)(await response.text());
    return ready;
};

const run = async ({ scriptUrl, wasmUrl, args, files, dataFiles, outputDirectory }: PluginWorkerRequest) => {
    const [module, data] = await Promise.all([
        loadPlugin(scriptUrl, wasmUrl),
        Promise.all(dataFiles.map(async ({ url, path }) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load plugin data ${url} (${response.status})`);
            }
            return { path, bytes: new Uint8Array(await response.arrayBuffer()) };
        }))
    ]);

    const write = (path: string, contents: string | Uint8Array) => {
        module.FS.mkdirTree(dirname(path));
        module.FS.writeFile(path, contents);
    };
    data.forEach(({ path, bytes }) => write(path, bytes));
    Object.entries(files).forEach(([path, contents]) => write(path, contents));
    module.FS.mkdirTree(outputDirectory);

    let exitCode: number;
    try {
        exitCode = module.callMain(args);
    } catch (error) {
        throw new Error(describeThrown(error));
    }

    const inputs = new Set(Object.keys(files));
    const outputs: Record<string, string> = {};
    for (const name of module.FS.readdir(outputDirectory)) {
        const path = `${outputDirectory}/${name}`;
        if (name === '.' || name === '..' || inputs.has(path)) continue;
        try {
            outputs[path] = module.FS.readFile(path, { encoding: 'utf8' });
        } catch {
            // Directories and unreadable entries are not plugin outputs.
        }
    }
    post({ type: 'done', exitCode, outputs });
};

self.onmessage = (event: MessageEvent<PluginWorkerRequest>) => {
    run(event.data).catch((error: unknown) => {
        post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    });
};
