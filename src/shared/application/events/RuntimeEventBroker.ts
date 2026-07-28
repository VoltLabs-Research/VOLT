import { getEventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import type { EventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import type { RuntimeProgressPayload } from '@shared/contracts/types/reverse-channel-runtime';
import { RuntimeProgressEvent } from '@shared/domain/events/runtime-events';
import { logAndSwallow } from '@shared/application/utilities/error-message';

const handlePublishError = logAndSwallow('warn', {}, 'Failed to publish runtime event');

export class RuntimeEventBroker {
    constructor(private readonly eventDispatcher: EventDispatcher) {}

    emitProgress(event: RuntimeProgressPayload): void {
        this.eventDispatcher.publish(new RuntimeProgressEvent(event)).catch(handlePublishError);
    }
}

let eventBrokerInstance: RuntimeEventBroker | null = null;

export const getEventBroker = (): RuntimeEventBroker => {
    eventBrokerInstance ??= new RuntimeEventBroker(getEventDispatcher());
    return eventBrokerInstance;
};
