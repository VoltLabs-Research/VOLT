// The page side of the backends: starts their workers, routes loopback connections between them,
// and opens connections of its own (the service worker's requests, and tests).
import type { LoopbackChannelMessage, LoopbackConnectMessage, LoopbackConnectionKind, LoopbackListenMessage, LoopbackRequestHead } from '../platform/loopback';
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
    private readonly ports = new Map<number, Worker>();
    private readonly listenWaiters = new Map<number, () => void>();
    private readonly workers = new Map<string, Worker>();
    onExit: (name: string, code: number) => void = () => {};
    onFailure: (name: string, message: string) => void = () => {};

    start(definition: BackendDefinition): Promise<void> {
        const worker = new Worker(definition.scriptUrl, { type: 'module', name: definition.name });
        this.workers.set(definition.name, worker);
        const listening = new Promise<void>((resolve) => this.listenWaiters.set(definition.port, resolve));
        const failed = new Promise<never>((_, reject) => {
            worker.addEventListener('message', (event: MessageEvent<HostMessage>) => {
                if(event.data.kind === 'failed'){
                    reject(new Error(`${definition.name} failed to start: ${event.data.message}`));
                }
            });
            worker.addEventListener('error', (event) => reject(new Error(`${definition.name}: ${event.message}`)));
        });
        worker.addEventListener('message', (event: MessageEvent<HostMessage>) => this.handle(definition.name, worker, event));
        worker.postMessage({ kind: 'boot', ...definition.boot } satisfies BackendBootMessage);
        return Promise.race([listening, failed]);
    }

    private handle(name: string, worker: Worker, event: MessageEvent<HostMessage>): void {
        const message = event.data;
        if(message.kind === 'listen'){
            this.ports.set(message.port, worker);
            this.listenWaiters.get(message.port)?.();
            this.listenWaiters.delete(message.port);
        }else if(message.kind === 'connect'){
            this.route(message, event.ports[0]);
        }else if(message.kind === 'exit'){
            this.onExit(name, message.code);
        }else if(message.kind === 'failed'){
            this.onFailure(name, message.message);
        }
    }

    private route(message: LoopbackConnectMessage, channel: MessagePort): void {
        const target = this.ports.get(message.port);
        if(!target){
            channel.postMessage({ type: 'error', message: `connect ECONNREFUSED 127.0.0.1:${message.port}` } satisfies LoopbackChannelMessage);
            channel.close();
            return;
        }
        target.postMessage(message, [channel]);
    }

    connect(port: number, connection: LoopbackConnectionKind, head: LoopbackRequestHead): MessagePort {
        const { port1, port2 } = new MessageChannel();
        this.route({ kind: 'connect', port, connection, head }, port2);
        return port1;
    }

    stop(): void {
        for(const worker of this.workers.values()){
            worker.terminate();
        }
        this.workers.clear();
        this.ports.clear();
    }
}
