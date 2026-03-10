import { type RuntimeLifecycleEvent, type RuntimeProgressEvent, EventType } from '../contracts/events';
import { EventEmitter } from 'node:events';

type RuntimeLifecycleListener = (event: RuntimeLifecycleEvent) => void;
type RuntimeProgressListener = (event: RuntimeProgressEvent) => void;

export class RuntimeEventBroker {
    private readonly emitter = new EventEmitter();
    private latestLifecycleEvent: RuntimeLifecycleEvent | null = null;

    emitLifecycle(event: RuntimeLifecycleEvent): void {
        this.latestLifecycleEvent = event;
        this.emitter.emit(EventType.RuntimeLifecycle, event);
    }

    emitProgress(event: RuntimeProgressEvent): void {
        this.emitter.emit(EventType.RuntimeProgress, event);
    }

    onLifecycle(listener: RuntimeLifecycleListener): () => void {
        this.emitter.on(EventType.RuntimeLifecycle, listener);
        return () => {
            this.emitter.off(EventType.RuntimeLifecycle, listener);
        };
    }

    onProgress(listener: RuntimeProgressListener): () => void {
        this.emitter.on(EventType.RuntimeProgress, listener);
        return () => {
            this.emitter.off(EventType.RuntimeProgress, listener);
        };
    }

    getLatestLifecycleEvent(): RuntimeLifecycleEvent | null {
        return this.latestLifecycleEvent;
    }
};
