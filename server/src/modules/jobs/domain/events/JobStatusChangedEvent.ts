import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';
import type { JobStatusChangedEventPayload } from '@shared/contracts/events/JobStatusChangedPayload';

// The payload type now lives in the neutral contracts layer
// (`@shared/contracts/events/JobStatusChangedPayload`) for the detachable-modules
// migration. Re-exported here so existing importers keep compiling unchanged.
// The event CLASS below stays in the jobs module.
export type { JobStatusChangedEventPayload };

export default class JobStatusChangedEvent extends BaseDomainEvent<JobStatusChangedEventPayload> {
    constructor(payload: JobStatusChangedEventPayload) {
        super('job.status.changed', payload);
    }
}
