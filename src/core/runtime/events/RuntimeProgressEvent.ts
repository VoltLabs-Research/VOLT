import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { RuntimeProgressPayload } from '@/core/runtime/contracts/reverse-channel-runtime';

export type RuntimeProgressEventData = RuntimeProgressPayload;

export class RuntimeProgressEvent extends BaseDomainEvent<RuntimeProgressEventData> {
    static readonly eventName = 'runtime.progress';

    constructor(payload: RuntimeProgressEventData) {
        super(RuntimeProgressEvent.eventName, payload);
    }
}
