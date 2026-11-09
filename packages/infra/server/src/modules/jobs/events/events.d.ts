import type { JobProgressChangedEventPayload } from '@shared/events/JobProgressChangedPayload';
import type { JobStatusChangedEventPayload } from '@shared/events/JobStatusChangedPayload';

declare global {
    interface EventMap {
        'job.status.changed': JobStatusChangedEventPayload;
        'job.progress.changed': JobProgressChangedEventPayload;
    }
}
