import { session, type Session } from 'electron';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

// The origin the window loads the web client from. Its requests never reach the network: the
// window's session answers them from the client's build, and lets every other https request out.
// An https origin keeps what the client builds from its own origin working as on a server
// (socket.io makes its URLs with http or https only); .invalid is reserved never to resolve.
export const CLIENT_ORIGIN = 'https://volt.invalid';

// The window's session. Its storage, the origin's private file system where the stack keeps the
// workspace, persists under userData.
const PARTITION = 'persist:volt';

// What the client's service worker adds to its responses in a browser: cross-origin isolation, which
// the stack's SharedArrayBuffers need. Here the page has it from its first load.
const ISOLATION_HEADERS = {
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'credentialless'
};

// By extension rather than the platform's MIME registry, which can serve scripts as text/plain.
const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.map': 'application/json',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8'
};

const isFile = (file: string): Promise<boolean> => stat(file).then((stats) => stats.isFile(), () => false);

// The build's file at a path, or index.html for the client's own routes, as a static host with a
// single-page fallback serves them.
const resolveFile = async (clientDir: string, pathname: string): Promise<string | null> => {
    let relative: string;
    try{
        relative = path.normalize(decodeURIComponent(pathname));
    }catch{
        return null;
    }
    const file = path.join(clientDir, relative);
    if(file !== clientDir && !file.startsWith(clientDir + path.sep)) return null;
    if(await isFile(file)) return file;
    return path.extname(relative) ? null : path.join(clientDir, 'index.html');
};

const serve = async (clientDir: string, request: Request): Promise<Response> => {
    const file = await resolveFile(clientDir, new URL(request.url).pathname);
    if(!file) return new Response('Not found', {
        status: 404,
        headers: ISOLATION_HEADERS
    });

    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
        headers: {
            ...ISOLATION_HEADERS,
            'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
            'cache-control': 'no-cache'
        }
    });
};

// The session the window loads the client in, serving the build at clientDir.
export const clientSession = (clientDir: string): Session => {
    const ses = session.fromPartition(PARTITION);
    ses.protocol.handle('https', (request) => (
        new URL(request.url).origin === CLIENT_ORIGIN
            ? serve(clientDir, request)
            : ses.fetch(request, { bypassCustomProtocolHandlers: true })
    ));
    return ses;
};
