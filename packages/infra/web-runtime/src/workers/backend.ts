// Entry of a backend worker, and of the processes a backend spawns. The realm that starts it boots it
// with the environment Node would give the process; the worker attaches its storage, then loads the
// program's own entry point, which starts exactly as `node dist/.../daemon.js` does on a Node machine.
import '../platform/timers-global';
import browserProcess from '../platform/process';
import { acceptLoopbackConnection, attachLoopbackParent } from '../platform/loopback';
import type { LoopbackConnectMessage, MessageTarget } from '../platform/loopback';
import { fetch } from '../platform/fetch';
import { WebSocketConstructor } from '../platform/ws';
import { attachFs, startFsService } from '../platform/fs/client';
import { initSqlite } from '../platform/better-sqlite3';
import { registerNodeProgram, registerNodeRunner } from '../platform/child-process';
import { attachStdin } from '../platform/stdio';
import { install } from '../platform/installs';
import { ownBytes } from '../platform/bytes';
import { deliverToParentPort, enterThread } from '../platform/worker-threads';
import { existsSync, mkdirSync, writeFileSync } from '../platform/fs';
import path from 'path';
import { homedir, tmpdir } from '../platform/os';
import type { BackendBootMessage, BackendWorkerMessage, ParentToChildMessage } from './protocol';

// Defined by scripts/build.mjs for each bundle.
declare const VOLT_PROGRAM_PATH: string;
declare const VOLT_NODE_PROGRAMS: Record<string, string>;
// What the backend's machine has installed besides it (src/platform/installs.ts), which its entry
// point installs at boot; the processes it spawns share its file system.
declare const VOLT_INSTALLS: string[];

// The parts of DedicatedWorkerGlobalScope used here (the WebWorker lib cannot be combined with DOM).
interface BackendWorkerScope extends MessageTarget {
    addEventListener(type: 'message', listener: (event: MessageEvent<BackendBootMessage | LoopbackConnectMessage | ParentToChildMessage>) => void): void;
    addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
    addEventListener(type: 'unhandledrejection', listener: (event: PromiseRejectionEvent) => void): void;
    close(): void;
}

const scope = globalThis as unknown as BackendWorkerScope;

// The channel to the parent, bound before the program loads: code written for Node may define its
// own `postMessage` global (Emscripten's pthreads point it at worker_threads' parentPort).
const parent: MessageTarget = { postMessage: scope.postMessage.bind(scope) };

const send = (message: BackendWorkerMessage, transfer: Transferable[] = []): void => parent.postMessage(message, transfer);

// Output goes to the parent as bytes of its own, transferred.
const sendOutput = (stream: 'stdout' | 'stderr', chunk: Uint8Array): void => {
    const bytes = ownBytes(chunk);
    send({ kind: 'output', stream, chunk: bytes }, [bytes.buffer]);
};

// Node realms have no `onmessage` event handler. A program assigning one as a plain global (as
// Emscripten's pthreads do, reading parentPort themselves) must not also receive this protocol. Nor
// do they have a read-only `self`, which the same programs assign the global to.
Object.defineProperty(globalThis, 'onmessage', { value: null, writable: true, configurable: true });
Object.defineProperty(globalThis, 'self', { value: globalThis, writable: true, configurable: true });

let isThread = false;

const isProcessExit = (value: unknown): boolean => (value as { name?: string } | undefined)?.name === 'ProcessExit';

const attachToParent = ({ serialization }: NonNullable<BackendBootMessage['child']>): void => {
    browserProcess.redirectOutput(sendOutput);
    browserProcess.connected = true;
    browserProcess.send = (message, ...rest) => {
        const callback = rest.find((arg): arg is (error: Error | null) => void => typeof arg === 'function');
        send({ kind: 'ipc', message: serialization === 'advanced' ? message : JSON.parse(JSON.stringify(message)) });
        callback?.(null);
        return true;
    };
};

const boot = async (message: BackendBootMessage): Promise<void> => {
    Object.assign(browserProcess.env, message.env);
    browserProcess.argv = ['/usr/local/bin/node', message.script ?? VOLT_PROGRAM_PATH, ...message.argv];
    browserProcess.chdir(message.cwd);
    browserProcess.stdin = attachStdin(message.child?.stdin);
    browserProcess.onExit = (code) => send({ kind: 'exit', code });
    Object.assign(globalThis, { fetch, WebSocket: WebSocketConstructor });
    for(const [scriptPath, workerFile] of Object.entries(VOLT_NODE_PROGRAMS)){
        registerNodeProgram(scriptPath, new URL(workerFile, import.meta.url));
    }
    registerNodeRunner(new URL('./node-runner.worker.js', import.meta.url));

    if('directory' in message.fs){
        await startFsService(new URL('./fs.worker.js', import.meta.url), message.fs.directory);
    }else{
        attachFs(message.fs);
    }
    // The directories every Linux machine has, which libraries create their files under.
    for(const directory of [tmpdir(), homedir(), browserProcess.cwd()]){
        mkdirSync(directory, { recursive: true });
    }
    // The programs are installed where the backend looks for them before spawning one.
    for(const scriptPath of Object.keys(VOLT_NODE_PROGRAMS)){
        if(!existsSync(scriptPath)){
            mkdirSync(path.dirname(scriptPath), { recursive: true });
            writeFileSync(scriptPath, `// Runs as ${VOLT_NODE_PROGRAMS[scriptPath]}, provided by @volt/web-runtime.\n`);
        }
    }
    for(const source of VOLT_INSTALLS){
        await install(source);
    }
    if(message.sqliteDirectory){
        await initSqlite(message.sqliteDirectory);
    }
    if(message.child){
        attachToParent(message.child);
    }
    if(message.thread){
        isThread = true;
        browserProcess.redirectOutput(sendOutput);
        enterThread({ ...message.thread, port: parent });
    }

    // As in Node: an error the program handles goes no further, and one it does not handle ends the
    // process. Neither reaches the page as an error of its own.
    scope.addEventListener('error', (event) => {
        event.preventDefault();
        if(isProcessExit(event.error)){
            return;
        }
        if(browserProcess.listenerCount('uncaughtException') > 0){
            browserProcess.emit('uncaughtException', event.error, 'uncaughtException');
            return;
        }
        crash(event.error);
    });
    scope.addEventListener('unhandledrejection', (event) => {
        event.preventDefault();
        if(isProcessExit(event.reason)){
            return;
        }
        if(browserProcess.listenerCount('unhandledRejection') > 0){
            browserProcess.emit('unhandledRejection', event.reason, event.promise);
            return;
        }
        if(browserProcess.listenerCount('uncaughtException') > 0){
            browserProcess.emit('uncaughtException', event.reason, 'unhandledRejection');
            return;
        }
        crash(event.reason);
    });

    attachLoopbackParent(parent);
    send({ kind: 'booted' });
    await import('volt-backend-entry');
};

const crash = (error: unknown): void => {
    browserProcess.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    send({ kind: 'exit', code: 1 });
    scope.close();
};

const SIGNAL_NUMBERS: Record<string, number> = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };

const handleSignal = (signal: string): void => {
    if(browserProcess.listenerCount(signal) > 0){
        browserProcess.emit(signal, signal);
        return;
    }
    // A signal nobody handles ends the process, as its default disposition does.
    send({ kind: 'exit', code: 128 + (SIGNAL_NUMBERS[signal] ?? 15) });
};

scope.addEventListener('message', (event) => {
    const message = event.data;
    if(message.kind === 'boot'){
        boot(message).catch((error: Error) => {
            if(!isProcessExit(error)){
                send({ kind: 'failed', message: error.stack ?? error.message });
            }
        });
    }else if(message.kind === 'connect'){
        acceptLoopbackConnection(message, event.ports[0]);
    }else if(message.kind === 'ipc'){
        if(isThread){
            deliverToParentPort(message.message);
        }else{
            browserProcess.emit('message', message.message);
        }
    }else if(message.kind === 'signal'){
        handleSignal(message.signal);
    }else if(message.kind === 'disconnect'){
        browserProcess.disconnect();
    }
});
