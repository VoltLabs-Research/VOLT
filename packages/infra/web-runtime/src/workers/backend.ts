// Entry of a backend worker, and of the processes a backend spawns. The realm that starts it boots it
// with the environment Node would give the process; the worker attaches its storage, then loads the
// program's own entry point, which starts exactly as `node dist/.../daemon.js` does on the desktop.
import '../platform/timers-global';
import browserProcess from '../platform/process';
import { acceptLoopbackConnection, attachLoopbackParent } from '../platform/loopback';
import type { LoopbackConnectMessage, MessageTarget } from '../platform/loopback';
import { fetch } from '../platform/fetch';
import { WebSocketConstructor } from '../platform/ws';
import { attachFsChannel, startFsService } from '../platform/fs/client';
import { initSqlite } from '../platform/better-sqlite3';
import { registerNodeProgram } from '../platform/child-process';
import { deliverToParentPort, enterThread } from '../platform/worker-threads';
import { existsSync, mkdirSync, writeFileSync } from '../platform/fs';
import path from 'path';
import { homedir, tmpdir } from '../platform/os';
import type { BackendBootMessage, BackendWorkerMessage, ParentToChildMessage } from './protocol';

// Defined by scripts/build.mjs for each bundle.
declare const VOLT_PROGRAM_PATH: string;
declare const VOLT_NODE_PROGRAMS: Record<string, string>;

// The parts of DedicatedWorkerGlobalScope used here (the WebWorker lib cannot be combined with DOM).
interface BackendWorkerScope extends MessageTarget {
    addEventListener(type: 'message', listener: (event: MessageEvent<BackendBootMessage | LoopbackConnectMessage | ParentToChildMessage>) => void): void;
    addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
    addEventListener(type: 'unhandledrejection', listener: (event: PromiseRejectionEvent) => void): void;
}

const scope = globalThis as unknown as BackendWorkerScope;

// The channel to the parent, bound before the program loads: code written for Node may define its
// own `postMessage` global (Emscripten's pthreads point it at worker_threads' parentPort).
const parent: MessageTarget = { postMessage: scope.postMessage.bind(scope) };

const send = (message: BackendWorkerMessage): void => parent.postMessage(message);

// Node realms have no `onmessage` event handler. A program assigning one as a plain global (as
// Emscripten's pthreads do, reading parentPort themselves) must not also receive this protocol.
Object.defineProperty(globalThis, 'onmessage', { value: null, writable: true, configurable: true });

let isThread = false;

const isProcessExit = (value: unknown): boolean => (value as { name?: string } | undefined)?.name === 'ProcessExit';

const attachToParent = ({ serialization }: NonNullable<BackendBootMessage['child']>): void => {
    browserProcess.redirectOutput((stream, text) => send({ kind: 'output', stream, text }));
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
    browserProcess.argv = ['/usr/local/bin/node', VOLT_PROGRAM_PATH, ...message.argv];
    browserProcess.chdir(message.cwd);
    browserProcess.onExit = (code) => send({ kind: 'exit', code });
    Object.assign(globalThis, { fetch, WebSocket: WebSocketConstructor });
    for(const [scriptPath, workerFile] of Object.entries(VOLT_NODE_PROGRAMS)){
        registerNodeProgram(scriptPath, new URL(workerFile, import.meta.url));
    }

    if('directory' in message.fs){
        await startFsService(new URL('./fs.worker.js', import.meta.url), message.fs.directory);
    }else{
        attachFsChannel(message.fs.channel);
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
    if(message.sqliteDirectory){
        await initSqlite(message.sqliteDirectory);
    }
    if(message.child){
        attachToParent(message.child);
    }
    if(message.thread){
        isThread = true;
        browserProcess.redirectOutput((stream, text) => send({ kind: 'output', stream, text }));
        enterThread({ ...message.thread, port: parent });
    }

    scope.addEventListener('error', (event) => {
        if(isProcessExit(event.error)){
            event.preventDefault();
            return;
        }
        browserProcess.emit('uncaughtException', event.error);
    });
    scope.addEventListener('unhandledrejection', (event) => {
        if(isProcessExit(event.reason)){
            event.preventDefault();
            return;
        }
        browserProcess.emit('unhandledRejection', event.reason, event.promise);
    });

    attachLoopbackParent(parent);
    send({ kind: 'booted' });
    await import('volt-backend-entry');
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
