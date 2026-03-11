import { DaemonSocketEvent } from '@voltstack/daemon-cluster-client';
import { EventEmitter } from 'node:events';
import type { RuntimeLifecycleEvent, RuntimeProgressEvent } from '@voltstack/daemon-cluster-client';

type RuntimeLifecycleListener = (event: RuntimeLifecycleEvent) => void;
type RuntimeProgressListener = (event: RuntimeProgressEvent) => void;

export class RuntimeEventBroker {
    private readonly emitter = new EventEmitter();
    private latestLifecycleEvent: RuntimeLifecycleEvent | null = null;

    emitLifecycle(event: RuntimeLifecycleEvent): void {
        this.latestLifecycleEvent = event;
        this.emitter.emit(DaemonSocketEvent.RuntimeLifecycle, event);
    }

    emitProgress(event: RuntimeProgressEvent): void {
        this.emitter.emit(DaemonSocketEvent.RuntimeProgress, event);
    }

    onLifecycle(listener: RuntimeLifecycleListener): () => void {
        this.emitter.on(DaemonSocketEvent.RuntimeLifecycle, listener);
        return () => {
            this.emitter.off(DaemonSocketEvent.RuntimeLifecycle, listener);
        };
    }

    onProgress(listener: RuntimeProgressListener): () => void {
        this.emitter.on(DaemonSocketEvent.RuntimeProgress, listener);
        return () => {
            this.emitter.off(DaemonSocketEvent.RuntimeProgress, listener);
        };
    }

    getLatestLifecycleEvent(): RuntimeLifecycleEvent | null {
        return this.latestLifecycleEvent;
    }
};
