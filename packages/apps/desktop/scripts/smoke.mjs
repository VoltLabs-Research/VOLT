#!/usr/bin/env node
// Runs the built app (pnpm run build, and the client's build) twice on a fresh profile. The first launch
// provisions the stack in the window and installs the default plugins, as wasm-wasm32 builds; the
// second finds the same workspace in the window's storage. Exits non-zero unless both reach the dashboard. SMOKE_KEEP=1 keeps the profile; SMOKE_VERBOSE=1
// prints Electron's output.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The electron package's main export, from Node, is the path of its binary.
const electron = require('electron');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 600_000);
const POLL_MS = 2_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const check = (label, ok, detail = '') => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
    if(!ok) process.exitCode = 1;
    return ok;
};

// Resolves the app's process and its DevTools endpoint once Chromium announces it.
const launch = (profile) => new Promise((resolve, reject) => {
    const child = spawn(electron, ['--no-sandbox', path.join(desktopDir, 'scripts', 'smoke-host.cjs'), `--user-data-dir=${profile}`], {
        stdio: ['ignore', process.env.SMOKE_VERBOSE ? 'inherit' : 'ignore', 'pipe']
    });
    let output = '';
    child.stderr.on('data', (chunk) => {
        if(process.env.SMOKE_VERBOSE) process.stderr.write(chunk);
        output += chunk;
        const match = output.match(/DevTools listening on ws:\/\/([^/\s]+)\//);
        if(match) resolve({ child, devtools: `http://${match[1]}` });
    });
    child.once('exit', (code) => reject(new Error(`the app exited with ${code} before DevTools listened`)));
});

// The app quits on SIGTERM as on a user's quit; one that hangs there is killed.
const stop = (child) => new Promise((resolve) => {
    if(child.exitCode !== null || child.signalCode !== null){
        resolve();
        return;
    }
    const kill = setTimeout(() => child.kill('SIGKILL'), 15_000);
    child.once('exit', () => {
        clearTimeout(kill);
        resolve();
    });
    child.kill('SIGTERM');
});

// A minimal DevTools protocol client over Node's WebSocket.
const connect = (url) => new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data);
        pending.get(message.id)?.(message);
        pending.delete(message.id);
    });
    socket.addEventListener('open', () => resolve({
        send: (method, params = {}) => new Promise((done) => {
            const id = nextId++;
            pending.set(id, done);
            socket.send(JSON.stringify({ id, method, params }));
        }),
        close: () => socket.close()
    }));
    socket.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)));
});

const findPage = async (devtools, deadline) => {
    while(Date.now() < deadline){
        const targets = await fetch(`${devtools}/json/list`).then((response) => response.json()).catch(() => []);
        const page = targets.find((target) => target.type === 'page' && target.url.startsWith('https://volt.invalid/'));
        if(page) return connect(page.webSocketDebuggerUrl);
        await sleep(500);
    }
    throw new Error('the window never loaded the client');
};

// What the page shows, and what its stack keeps in the origin's storage.
const PROBE = `(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('volt-local-stack.json').catch(() => null);
    const text = handle ? await (await handle.getFile()).text() : '';
    const stored = text ? JSON.parse(text) : {};
    const booting = document.getElementById('local-stack-title') !== null;
    return {
        isolated: globalThis.crossOriginIsolated,
        controlled: navigator.serviceWorker.controller !== null,
        persisted: await navigator.storage.persisted(),
        rendered: document.getElementById('root')?.childElementCount > 0 && !booting,
        failure: booting ? document.querySelector('[role=alert]')?.textContent ?? null : null,
        lastLog: document.querySelector('pre')?.textContent.split('\\n').at(-1) ?? null,
        teamClusterId: stored.bootstrap?.teamClusterId ?? null,
        seed: stored.pluginSeed ?? null
    };
})()`;

const probe = async (page) => {
    const response = await page.send('Runtime.evaluate', { expression: PROBE, awaitPromise: true, returnByValue: true });
    // A navigation (the first start reloads once, under its service worker) loses the evaluation.
    return response.result?.result?.value ?? null;
};

// A request of the client's own, to a route that needs no session: its status, or 0 if it never answers.
const API_REQUEST = `fetch('/api/auth/emails/smoke%40volt.local/availability', { signal: AbortSignal.timeout(10000) })
    .then((response) => response.status, () => 0)`;

const evaluate = async (page, expression) => {
    const response = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return response.result?.result?.value ?? null;
};

// Polls the page until the app renders, printing the boot log's progress.
const waitForDashboard = async (page, deadline) => {
    let lastLog = null;
    while(Date.now() < deadline){
        const state = await probe(page).catch(() => null);
        if(state?.lastLog && state.lastLog !== lastLog){
            lastLog = state.lastLog;
            console.log(`      ${lastLog.slice(0, 160)}`);
        }
        if(state?.failure) throw new Error(state.failure);
        if(state?.rendered && state.teamClusterId){
            // What the app asks its backend goes through the service worker's relay.
            return { ...state, apiStatus: await evaluate(page, API_REQUEST) };
        }
        await sleep(POLL_MS);
    }
    throw new Error(`the dashboard did not render within ${TIMEOUT_MS / 1000}s`);
};

const run = async (profile, label) => {
    console.log(`\n${label}`);
    const startedAt = Date.now();
    const { child, devtools } = await launch(profile);
    const deadline = Date.now() + TIMEOUT_MS;
    try{
        const page = await findPage(devtools, deadline);
        try{
            const state = await waitForDashboard(page, deadline);
            console.log(`  dashboard after ${Math.round((Date.now() - startedAt) / 1000)}s`);
            return state;
        }finally{
            page.close();
        }
    }finally{
        await stop(child);
    }
};

const main = async () => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'volt-desktop-smoke-'));
    try{
        const first = await run(profile, 'first launch: provision the workspace');
        check('page is cross-origin isolated', first.isolated);
        check('service worker relays the backend requests', first.controlled && first.apiStatus === 200, `status ${first.apiStatus}`);
        check('window storage is persistent', first.persisted);
        check('plugins installed as wasm builds', first.seed?.platform === 'wasm-wasm32', first.seed?.platform);
        check('every default plugin installed', first.seed?.done === true, `${first.seed?.installed?.length ?? 0} installed`);

        const second = await run(profile, 'second launch: reuse the workspace');
        check('workspace survives a restart', second.teamClusterId === first.teamClusterId, second.teamClusterId);
        check('backend answers after a restart', second.apiStatus === 200, `status ${second.apiStatus}`);
        check('plugins stay installed', second.seed?.done === true && second.seed.installed.length === first.seed.installed.length);
    }finally{
        if(!process.env.SMOKE_KEEP) await rm(profile, { recursive: true, force: true });
        else console.log(`\nprofile kept at ${profile}`);
    }
    console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE OK');
};

main().catch((error) => {
    console.error(`\nSMOKE FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
