import type { UserActivityRecordedPayload } from '@shared/events/UserActivityRecordedPayload';

declare global {
    interface EventMap {
        'user-activity.recorded': UserActivityRecordedPayload;
    }
}
