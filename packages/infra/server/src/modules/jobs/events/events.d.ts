import type { JobStatusChangedEventPayload } from '@shared/events/JobStatusChangedPayload';

declare global {
    interface EventMap {
        'job.status.changed': JobStatusChangedEventPayload;
    }
}
