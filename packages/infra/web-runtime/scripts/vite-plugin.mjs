// A Vite plugin serving the runtime to a web client: its built workers (dist) under /volt-runtime/, and
// its service worker at the root of the origin, which a worker's scope can be no wider than. Both are
// served in development and preview and copied into the build. The client reads where they are from
// `virtual:volt-web-runtime`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const RUNTIME_BASE = '/volt-runtime/';
const SERVICE_WORKER_PATH = '/volt-service-worker.js';
const VIRTUAL_ID = 'virtual:volt-web-runtime';

const CONTENT_TYPES = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.map': 'application/json' };

// The smoke pages are the runtime's own tests, not part of what a client serves.
const isServed = (relative) => !relative.split(path.sep).includes('smoke');

const fileFor = (url) => {
    const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    const relative = pathname === SERVICE_WORKER_PATH
        ? 'service-worker.js'
        : pathname.startsWith(RUNTIME_BASE) ? path.normalize(pathname.slice(RUNTIME_BASE.length)) : null;
    if(!relative || relative.startsWith('..') || !isServed(relative)){
        return null;
    }
    const file = path.join(distDir, relative);
    return existsSync(file) && statSync(file).isFile() ? file : null;
};

const serve = (request, response, next) => {
    const file = fileFor(request.url ?? '/');
    if(!file){
        next();
        return;
    }
    response.setHeader('content-type', CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream');
    response.setHeader('cache-control', 'no-cache');
    createReadStream(file).pipe(response);
};

export default function voltWebRuntime(){
    let outDir = null;
    return {
        name: 'volt-web-runtime',
        configResolved(config){
            outDir = path.resolve(config.root, config.build.outDir);
        },
        resolveId(id){
            return id === VIRTUAL_ID ? `\0${VIRTUAL_ID}` : null;
        },
        load(id){
            if(id !== `\0${VIRTUAL_ID}`){
                return null;
            }
            return [
                `export const runtimeUrl = new URL(${JSON.stringify(RUNTIME_BASE)}, location.origin);`,
                `export const serviceWorkerUrl = new URL(${JSON.stringify(SERVICE_WORKER_PATH)}, location.origin);`
            ].join('\n');
        },
        configureServer(server){
            server.middlewares.use(serve);
        },
        configurePreviewServer(server){
            server.middlewares.use(serve);
        },
        async closeBundle(){
            if(!outDir || !existsSync(path.join(distDir, 'service-worker.js'))){
                throw new Error(`@volt/web-runtime: ${distDir} is not built (run its build first)`);
            }
            await cp(distDir, path.join(outDir, RUNTIME_BASE), {
                recursive: true,
                filter: (source) => isServed(path.relative(distDir, source))
            });
            await copyFile(path.join(distDir, 'service-worker.js'), path.join(outDir, SERVICE_WORKER_PATH));
        }
    };
}
