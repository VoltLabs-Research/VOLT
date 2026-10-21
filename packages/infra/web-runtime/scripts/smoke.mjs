#!/usr/bin/env node
// Runs smoke/page.ts in headless Chrome against the built workers (pnpm run build first) and prints
// every SMOKE line it reports. Exits non-zero unless the page reaches its last step.
import * as esbuild from 'esbuild';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(packageDir, 'dist');
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);

const CONTENT_TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.map': 'application/json' };

await esbuild.build({
    entryPoints: [path.join(packageDir, 'smoke', 'page.ts')],
    outfile: path.join(distDir, 'smoke', 'page.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'warning'
});

const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const file = url.pathname === '/'
        ? null
        : path.join(distDir, path.normalize(url.pathname));
    // COOP/COEP as the client will be served with, so the workers get the same capabilities.
    const headers = { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' };
    if(!file){
        response.writeHead(200, { ...headers, 'content-type': 'text/html' });
        response.end('<!doctype html><script type="module" src="/smoke/page.js"></script>');
        return;
    }
    if(!file.startsWith(distDir) || !existsSync(file)){
        response.writeHead(404, headers);
        response.end();
        return;
    }
    response.writeHead(200, { ...headers, 'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
}).listen(0);

const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

const finished = new Promise((resolve) => {
    const onLine = (text) => {
        if(text.startsWith('SMOKE ')){
            console.log(text);
            if(text.startsWith('SMOKE done') || text.startsWith('SMOKE error')){
                resolve(text.startsWith('SMOKE done'));
            }
        }else if(process.env.SMOKE_VERBOSE){
            console.log(`  ${text}`);
        }
    };
    // Error objects arrive as handles; their stack is what is worth printing.
    const describe = async (message) => {
        const parts = await Promise.all(message.args().map((arg) => arg.evaluate((value) => (
            value instanceof Error ? value.stack : typeof value === 'object' ? JSON.stringify(value) : String(value)
        )).catch(() => arg.toString())));
        return parts.length > 0 ? parts.join(' ') : message.text();
    };
    page.on('console', async (message) => onLine(await describe(message)));
    page.on('pageerror', (error) => console.log(`  page error: ${error.message}`));
    page.on('workercreated', (worker) => worker.on('console', async (message) => onLine(await describe(message))));
    setTimeout(() => resolve(false), TIMEOUT_MS);
});

await page.goto(`http://localhost:${port}/`);
const passed = await finished;
await browser.close();
server.close();
process.exit(passed ? 0 : 1);
