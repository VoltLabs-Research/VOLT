import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import httpProxy from 'http-proxy';

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
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
    '.wasm': 'application/wasm',
    '.map': 'application/json'
};

const isProxiedPath = (url = ''): boolean => url.startsWith('/api') || url.startsWith('/socket.io');

// Stable loopback port so the client's origin (and its persisted localStorage) survives restarts.
const CLIENT_PORT = 47813;

/**
 * Serves the compiled Volt client as a local origin and reverse-proxies its API and
 * Socket.IO traffic to the active deployment (local stack or a remote server). Running
 * the client locally removes render latency; same-origin requests remove CORS. The
 * Origin header is stripped on the proxied hop so the upstream treats it as non-CORS.
 */
export default class ClientServer{
    #server?: http.Server;
    #url = '';
    #target = '';
    #proxy = httpProxy.createProxyServer({ changeOrigin: true, secure: false, ws: true, xfwd: true });

    constructor(private readonly clientDir: string){
        this.#proxy.on('error', () => { /* upstream hiccups surface as client-side fetch errors */ });
        this.#proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
        this.#proxy.on('proxyReqWs', (proxyReq) => proxyReq.removeHeader('origin'));
    }

    setTarget(target: string){ this.#target = target; }
    get url(){ return this.#url; }

    ensureStarted(): Promise<string>{
        if(this.#server) return Promise.resolve(this.#url);

        const server = http.createServer((req, res) => this.#handle(req, res));
        server.on('upgrade', (req, socket, head) => {
            if(this.#target && isProxiedPath(req.url)){
                this.#proxy.ws(req, socket, head, { target: this.#target });
            }else{
                socket.destroy();
            }
        });

        this.#server = server;
        return new Promise((resolve) => {
            const finish = () => {
                this.#url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
                resolve(this.#url);
            };
            // Fixed port keeps the client's origin (and its localStorage: auth, prefs)
            // stable across launches; fall back to an ephemeral port only if it's taken.
            server.on('error', (err: NodeJS.ErrnoException) => {
                if(err.code === 'EADDRINUSE' && !this.#url) server.listen(0, '127.0.0.1', finish);
            });
            server.listen(CLIENT_PORT, '127.0.0.1', finish);
        });
    }

    #handle(req: http.IncomingMessage, res: http.ServerResponse){
        if(this.#target && isProxiedPath(req.url)){
            this.#proxy.web(req, res, { target: this.#target });
            return;
        }
        this.#serveStatic(req, res);
    }

    #serveStatic(req: http.IncomingMessage, res: http.ServerResponse){
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = path.normalize(path.join(this.clientDir, urlPath));

        // Contain traversal, then fall back to index.html for SPA client routes.
        if(!filePath.startsWith(this.clientDir)){
            res.statusCode = 403;
            res.end();
            return;
        }
        if(!existsSync(filePath) || statSync(filePath).isDirectory()){
            filePath = path.join(this.clientDir, 'index.html');
        }
        if(!existsSync(filePath)){
            res.statusCode = 404;
            res.end('Client build not found');
            return;
        }

        res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
        createReadStream(filePath).on('error', () => { res.statusCode = 500; res.end(); }).pipe(res);
    }
};
