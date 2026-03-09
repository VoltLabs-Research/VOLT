import { RuntimeEventName, RuntimeLifecycleEvent, RuntimeProgressEvent } from '../contracts/events';
import { EventEmitter } from 'node:events';

type RuntimeLifecycleListener = (event: RuntimeLifecycleEvent) => void;
type RuntimeProgressListener = (event: RuntimeProgressEvent) => void;

export class RuntimeEventBroker {
    private readonly emitter = new EventEmitter();
    private latestLifecycleEvent: RuntimeLifecycleEvent | null = null;

    emitLifecycle(event: RuntimeLifecycleEvent): void {
        this.latestLifecycleEvent = event;
        this.emitter.emit(RuntimeEventName.Lifecycle, event);
    }

    emitProgress(event: RuntimeProgressEvent): void {
        this.emitter.emit(RuntimeEventName.Progress, event);
    }

    onLifecycle(listener: RuntimeLifecycleListener): () => void {
        this.emitter.on(RuntimeEventName.Lifecycle, listener);
        return () => {
            this.emitter.off(RuntimeEventName.Lifecycle, listener);
        };
    }

    onProgress(listener: RuntimeProgressListener): () => void {
        this.emitter.on(RuntimeEventName.Progress, listener);
        return () => {
            this.emitter.off(RuntimeEventName.Progress, listener);
        };
    }

    getLatestLifecycleEvent(): RuntimeLifecycleEvent | null {
        return this.latestLifecycleEvent;
    }
}
