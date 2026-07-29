import type { ChatDeletedEventPayload } from '@modules/chat/contracts/domain/events';

declare global {
    interface EventMap {
        'chat.deleted': ChatDeletedEventPayload;
    }
}
