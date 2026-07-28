import type { ChatDeletedEventPayload } from '@modules/chat/events/ChatDeletedEvent';

declare global {
    interface EventMap {
        'chat.deleted': ChatDeletedEventPayload;
    }
}
