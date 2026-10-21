import { WASM_PLUGIN_BASE_URL } from './constants';
import { PLUGIN_DATA_ROOT } from './run-pipeline';
import type { PluginExecutor } from './run-pipeline';
import type { PluginWorkerMessage, PluginWorkerRequest } from './plugin-worker';

// Each run gets a fresh worker: Emscripten modules keep global state between callMain() calls.
export const runPluginInWorker: PluginExecutor = ({ binary, args, files, dataFiles, outputDirectory, onLog, signal }) => {
    const baseUrl = new URL(`${WASM_PLUGIN_BASE_URL}/`, window.location.origin);
    const request: PluginWorkerRequest = {
        scriptUrl: new URL(`${binary}.js`, baseUrl).href,
        wasmUrl: new URL(`${binary}.wasm`, baseUrl).href,
        args,
        files,
        dataFiles: dataFiles.map((file) => ({
            url: new URL(`data/${binary}/${file}`, baseUrl).href,
            path: `${PLUGIN_DATA_ROOT}/${file}`
        })),
        outputDirectory
    };

    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error(`${binary} was cancelled`));
            return;
        }
        const worker = new Worker(new URL('./plugin-worker.ts', import.meta.url), { type: 'module' });
        const finish = () => {
            worker.terminate();
            signal?.removeEventListener('abort', cancel);
        };
        const cancel = () => {
            finish();
            reject(new Error(`${binary} was cancelled`));
        };
        signal?.addEventListener('abort', cancel, { once: true });
        worker.onmessage = (event: MessageEvent<PluginWorkerMessage>) => {
            const message = event.data;
            if (message.type === 'log') {
                onLog(message.line);
                return;
            }
            finish();
            if (message.type === 'done') {
                resolve({ exitCode: message.exitCode, outputs: message.outputs });
            } else {
                reject(new Error(message.message));
            }
        };
        worker.onerror = (event) => {
            finish();
            reject(new Error(event.message || `The ${binary} worker crashed`));
        };
        worker.postMessage(request);
    });
};
