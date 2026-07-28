import type { UserCreatedEventPayload } from '@modules/auth/events/UserCreatedEvent';
import type { UserDeletedEventPayload } from '@modules/auth/events/UserDeletedEvent';

declare global {
    interface EventMap {
        'user.created': UserCreatedEventPayload;
        'user.deleted': UserDeletedEventPayload;
    }
}
