// The page side of the backends: starts their workers, which reach each other over the loopback
// network with this page as its root, and opens connections of its own (the service worker's
// requests, and tests).
import { connectLoopback, forgetChildRoutes, handleChildLoopbackMessage } from '../platform/loopback';
import { fetch as loopbackAwareFetch } from '../platform/fetch';
import type { LoopbackConnectMessage, LoopbackConnectionKind, LoopbackListenMessage, LoopbackRequestHead } from '../platform/loopback';
import type { BackendBootMessage, BackendWorkerMessage } from '../workers/protocol';

export interface BackendDefinition {
    name: string;
    scriptUrl: string | URL;
    boot: Omit<BackendBootMessage, 'kind'>;
    // The port it serves on; start() resolves once the backend listens there.
    port: number;
}

type HostMessage = LoopbackListenMessage | LoopbackConnectMessage | BackendWorkerMessage;

export class BackendHost {
    private readonly workers = new Map<string, Worker>();
    // fetch() for this page that reaches the backends' loopback ports (provisioning talks to the server).
    readonly fetch = loopbackAwareFetch;
    onExit: (name: string, code: number) => void = () => {};
    onFailure: (name: string, message: string) => void = () => {};

    start(definition: BackendDefinition): Promise<void> {
        const worker = new Worker(definition.scriptUrl, { type: 'module', name: definition.name });
        this.workers.set(definition.name, worker);
        return new Promise<void>((resolve, reject) => {
            worker.addEventListener('error', (event) => reject(new Error(`${definition.name}: ${event.message}`)));
            worker.addEventListener('message', (event: MessageEvent<HostMessage>) => {
                const message = event.data;
                if(message.kind === 'listen' || message.kind === 'connect'){
                    handleChildLoopbackMessage(worker, message, event.ports);
                    if(message.kind === 'listen' && message.port === definition.port){
                        resolve();
                    }
                }else if(message.kind === 'exit'){
                    forgetChildRoutes(worker);
                    this.onExit(definition.name, message.code);
                }else if(message.kind === 'failed'){
                    reject(new Error(`${definition.name} failed to start: ${message.message}`));
                    this.onFailure(definition.name, message.message);
                }
            });
            worker.postMessage({ kind: 'boot', ...definition.boot } satisfies BackendBootMessage);
        });
    }

    connect(port: number, connection: LoopbackConnectionKind, head: LoopbackRequestHead): MessagePort {
        return connectLoopback(port, connection, head);
    }

    stop(): void {
        for(const worker of this.workers.values()){
            forgetChildRoutes(worker);
            worker.terminate();
        }
        this.workers.clear();
    }
}
