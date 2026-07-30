import type { ChatDeletedEventPayload } from '@modules/chat/contracts/events';

declare global {
    interface EventMap {
        'chat.deleted': ChatDeletedEventPayload;
    }
}
