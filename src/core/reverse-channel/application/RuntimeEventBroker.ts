import type { EventDispatcher } from '@/core/events/EventDispatcher';
import type { RuntimeLifecycleEventData } from '@/core/runtime/events/RuntimeLifecycleEvent';
import type { RuntimeProgressEventData } from '@/core/runtime/events/RuntimeProgressEvent';
import { logger } from '@/core/logger';
import { RuntimeLifecycleEvent } from '@/core/runtime/events/RuntimeLifecycleEvent';
import { RuntimeProgressEvent } from '@/core/runtime/events/RuntimeProgressEvent';

export class RuntimeEventBroker {
    constructor(private readonly eventDispatcher: EventDispatcher) {}

    emitLifecycle(event: RuntimeLifecycleEventData): void {
        this.eventDispatcher.publish(new RuntimeLifecycleEvent(event)).catch((error) => {
            logger.warn(`Failed to publish runtime event ${RuntimeLifecycleEvent.eventName}: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    emitProgress(event: RuntimeProgressEventData): void {
        this.eventDispatcher.publish(new RuntimeProgressEvent(event)).catch((error) => {
            logger.warn(`Failed to publish runtime event ${RuntimeProgressEvent.eventName}: ${error instanceof Error ? error.message : String(error)}`);
        });
    }
}
