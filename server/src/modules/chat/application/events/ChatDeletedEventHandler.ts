import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import ChatDeletedEvent from '@modules/chat/domain/events/ChatDeletedEvent';
import { inject, injectable } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IChatMessageRepository } from '@modules/chat/domain/port/chat-message/IChatMessageRepository';

@injectable()
export default class ChatDeletedEventHandler implements IEventHandler<ChatDeletedEvent> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private readonly chatMessageRepository: IChatMessageRepository
    ){}

    async handle(event: ChatDeletedEvent): Promise<void> {
        const { chatId } = event.payload;

        await this.chatMessageRepository.deleteMany({ chat: chatId });
    }
};
