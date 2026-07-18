import ChatMessageModel from '@modules/chat/models/chat-message/ChatMessageModel';
import ChatDeletedEvent from '@modules/chat/events/ChatDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

/**
 * Purges a deleted chat's messages. Uses {@link ChatMessageModel} directly (the
 * chat repository layer was removed in the pollium conversion).
 */
@Subscribe('chat.deleted')
export default class ChatDeletedEventHandler implements IEventHandler<ChatDeletedEvent> {
    async handle(event: ChatDeletedEvent): Promise<void> {
        const { chatId } = event.payload;
        await ChatMessageModel.deleteMany({ chat: chatId });
    }
}
