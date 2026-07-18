import { CHAT_TOKENS } from '@modules/chat/di/ChatTokens';
import type { IChatMessageRepository } from '@modules/chat/ports/chat-message/IChatMessageRepository';
import ChatDeletedEvent from '@modules/chat/events/ChatDeletedEvent';
import { inject } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('chat.deleted')
export default class ChatDeletedEventHandler implements IEventHandler<ChatDeletedEvent> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly chatMessageRepository: IChatMessageRepository
    ){}

    async handle(event: ChatDeletedEvent): Promise<void> {
        const { chatId } = event.payload;

        await this.chatMessageRepository.deleteMany({ chat: chatId });
    }
}
