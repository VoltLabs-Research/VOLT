import type { UserCreatedEventPayload, UserDeletedEventPayload } from '@modules/auth/contracts/events';

declare global {
    interface EventMap {
        'user.created': UserCreatedEventPayload;
        'user.deleted': UserDeletedEventPayload;
    }
}
