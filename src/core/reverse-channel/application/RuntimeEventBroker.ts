import type { IEventBus } from '@/core/events/IEventBus';
import type { RuntimeLifecycleEventData } from '@/core/runtime/events/RuntimeLifecycleEvent';
import type { RuntimeProgressEventData } from '@/core/runtime/events/RuntimeProgressEvent';
import { logger } from '@/core/logger';
import { RuntimeLifecycleEvent } from '@/core/runtime/events/RuntimeLifecycleEvent';
import { RuntimeProgressEvent } from '@/core/runtime/events/RuntimeProgressEvent';

export class RuntimeEventBroker {
    constructor(private readonly eventBus: IEventBus) {}

    emitLifecycle(event: RuntimeLifecycleEventData): void {
        this.eventBus.publish(new RuntimeLifecycleEvent(event)).catch((error) => {
            logger.warn({ err: error, eventName: RuntimeLifecycleEvent.eventName }, 'Failed to publish runtime event');
        });
    }

    emitProgress(event: RuntimeProgressEventData): void {
        this.eventBus.publish(new RuntimeProgressEvent(event)).catch((error) => {
            logger.warn({ err: error, eventName: RuntimeProgressEvent.eventName }, 'Failed to publish runtime event');
        });
    }
}
