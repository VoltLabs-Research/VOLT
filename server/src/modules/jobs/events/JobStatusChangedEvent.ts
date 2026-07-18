import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';
import type { JobStatusChangedEventPayload } from '@shared/contracts/events/JobStatusChangedPayload';

export type { JobStatusChangedEventPayload };

export default class JobStatusChangedEvent extends BaseDomainEvent<JobStatusChangedEventPayload> {
    constructor(payload: JobStatusChangedEventPayload) {
        super('job.status.changed', payload);
    }
}
