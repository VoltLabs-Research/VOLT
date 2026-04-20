import { Service } from '@/core/decorators/service';
import type { EventDispatcher } from '@/core/events/EventDispatcher';
import type { RuntimeLifecycleEvent as DaemonRuntimeLifecycleEvent } from '@voltstack/daemon-cluster-client';
import type { RuntimeProgressPayload } from '@/core/runtime/contracts/reverse-channel-runtime';
import {
    RuntimeLifecycleEvent,
    RuntimeProgressEvent,
} from '@/core/runtime/domain/events';
import { logAndSwallow } from '@/support/error/errorMessage';

const handlePublishError = logAndSwallow('warn', {}, 'Failed to publish runtime event');

@Service('eventBroker')
export class RuntimeEventBroker {
    constructor(private readonly eventDispatcher: EventDispatcher) {}

    emitLifecycle(event: DaemonRuntimeLifecycleEvent): void {
        this.eventDispatcher.publish(new RuntimeLifecycleEvent(event)).catch(handlePublishError);
    }

    emitProgress(event: RuntimeProgressPayload): void {
        this.eventDispatcher.publish(new RuntimeProgressEvent(event)).catch(handlePublishError);
    }
}
