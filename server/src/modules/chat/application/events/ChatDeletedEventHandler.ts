import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import type ChatMessageRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat-message/ChatMessageRepository';
import ChatDeletedEvent from '@modules/chat/domain/events/ChatDeletedEvent';
import { inject } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('chat.deleted')
export default class ChatDeletedEventHandler implements IEventHandler<ChatDeletedEvent> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly chatMessageRepository: ChatMessageRepository
    ){}

    async handle(event: ChatDeletedEvent): Promise<void> {
        const { chatId } = event.payload;

        await this.chatMessageRepository.deleteMany({ chat: chatId });
    }
}
