import { DaemonSocketEvent } from '@voltstack/daemon-cluster-client';
import { EventEmitter } from 'node:events';
import type { RuntimeLifecycleEvent, RuntimeProgressEvent } from '@voltstack/daemon-cluster-client';

type RuntimeProgressListener = (event: RuntimeProgressEvent) => void;

export class RuntimeEventBroker {
    private readonly emitter = new EventEmitter();

    emitLifecycle(event: RuntimeLifecycleEvent): void {
        this.emitter.emit(DaemonSocketEvent.RuntimeLifecycle, event);
    }

    emitProgress(event: RuntimeProgressEvent): void {
        this.emitter.emit(DaemonSocketEvent.RuntimeProgress, event);
    }

    onProgress(listener: RuntimeProgressListener): () => void {
        this.emitter.on(DaemonSocketEvent.RuntimeProgress, listener);
        return () => {
            this.emitter.off(DaemonSocketEvent.RuntimeProgress, listener);
        };
    }
};
