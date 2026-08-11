import type { UserActivityRecordedPayload } from '@shared/contracts/events/UserActivityRecordedPayload';

declare global {
    interface EventMap {
        'user-activity.recorded': UserActivityRecordedPayload;
    }
}
