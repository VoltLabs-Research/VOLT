import { singleton } from '@shared/utilities/singleton';
import { getEventDispatcher } from '@shared/events/EventDispatcher';
import type { EventDispatcher } from '@shared/events/EventDispatcher';
import type { RuntimeProgressPayload } from '@shared/contracts/types/reverse-channel-runtime';
import { RuntimeProgressEvent } from '@shared/events/runtime-events';
import { logAndSwallow } from '@shared/utilities/error-message';

const handlePublishError = logAndSwallow('warn', {}, 'Failed to publish runtime event');

export class RuntimeEventBroker {
    constructor(private readonly eventDispatcher: EventDispatcher) {}

    emitProgress(event: RuntimeProgressPayload): void {
        this.eventDispatcher.publish(new RuntimeProgressEvent(event)).catch(handlePublishError);
    }
}

export const getEventBroker = singleton((): RuntimeEventBroker => new RuntimeEventBroker(getEventDispatcher()));
