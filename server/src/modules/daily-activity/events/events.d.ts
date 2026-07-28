import type { UserActivityRecordedPayload } from '@shared/contracts/events';

declare global {
    interface EventMap {
        'user-activity.recorded': UserActivityRecordedPayload;
    }
}
