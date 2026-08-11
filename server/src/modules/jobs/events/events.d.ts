import type { JobStatusChangedEventPayload } from '@shared/contracts/events/JobStatusChangedPayload';

declare global {
    interface EventMap {
        'job.status.changed': JobStatusChangedEventPayload;
    }
}
