import type { JobStatusChangedEventPayload } from '@shared/contracts/events';

declare global {
    interface EventMap {
        'job.status.changed': JobStatusChangedEventPayload;
    }
}
