import ChatMessageModel from '@modules/chat/models/chat-message/ChatMessageModel';
import ChatDeletedEvent from '@modules/chat/events/ChatDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class ChatDeletedEventHandler implements IEventHandler<ChatDeletedEvent> {
    async handle(event: ChatDeletedEvent): Promise<void> {
        const { chatId } = event.payload;
        await ChatMessageModel.deleteMany({ chat: chatId });
    }
}

const chatDeletedEventHandler = new ChatDeletedEventHandler();
subscribeHandler('chat.deleted', chatDeletedEventHandler);

export default chatDeletedEventHandler;
