// Entry of a backend worker. The host page boots it with the environment the desktop would put in the
// process's env; the worker mounts its storage, then loads the backend's own entry point, which
// starts exactly as `node dist/.../server.js` (or daemon.js) does on the desktop.
import '../platform/timers-global';
import browserProcess from '../platform/process';
import { acceptLoopbackConnection, attachLoopbackHost } from '../platform/loopback';
import type { LoopbackConnectMessage } from '../platform/loopback';
import { fetch } from '../platform/fetch';
import { WebSocketConstructor } from '../platform/ws';
import { startFsService } from '../platform/fs/client';
import { initSqlite } from '../platform/better-sqlite3';
import type { BackendBootMessage, BackendWorkerMessage } from './protocol';

declare const VOLT_BACKEND_NAME: string;

// The parts of DedicatedWorkerGlobalScope used here (the WebWorker lib cannot be combined with DOM).
interface BackendWorkerScope {
    postMessage(message: BackendWorkerMessage): void;
    addEventListener(type: 'message', listener: (event: MessageEvent<BackendBootMessage | LoopbackConnectMessage>) => void): void;
    addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
    addEventListener(type: 'unhandledrejection', listener: (event: PromiseRejectionEvent) => void): void;
}

const scope = globalThis as unknown as BackendWorkerScope;

const send = (message: BackendWorkerMessage): void => scope.postMessage(message);

const boot = async (message: BackendBootMessage): Promise<void> => {
    Object.assign(browserProcess.env, message.env);
    browserProcess.argv = ['/usr/local/bin/node', `/app/${VOLT_BACKEND_NAME}.js`, ...message.argv];
    browserProcess.chdir(message.cwd);
    browserProcess.onExit = (code) => send({ kind: 'exit', code });
    Object.assign(globalThis, { fetch, WebSocket: WebSocketConstructor });

    await startFsService(new URL('./fs.worker.js', import.meta.url), message.fsDirectory);
    await initSqlite(message.sqliteDirectory);

    scope.addEventListener('error', (event) => {
        if((event.error as { name?: string } | undefined)?.name === 'ProcessExit'){
            event.preventDefault();
        }
    });
    scope.addEventListener('unhandledrejection', (event) => {
        if((event.reason as { name?: string } | undefined)?.name === 'ProcessExit'){
            event.preventDefault();
            return;
        }
        browserProcess.emit('unhandledRejection', event.reason, event.promise);
    });

    attachLoopbackHost(scope as unknown as Pick<MessagePort, 'postMessage'>);
    send({ kind: 'booted' });
    await import('volt-backend-entry');
};

scope.addEventListener('message', (event) => {
    const message = event.data;
    if(message.kind === 'boot'){
        boot(message).catch((error: Error) => send({ kind: 'failed', message: error.stack ?? error.message }));
    }else if(message.kind === 'connect'){
        acceptLoopbackConnection(message, event.ports[0]);
    }
});
