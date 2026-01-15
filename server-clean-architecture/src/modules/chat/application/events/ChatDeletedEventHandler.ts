import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import { CHAT_TOKENS } from '../../infrastructure/di/ChatTokens';
import { IChatMessageRepository } from '../../domain/port/IChatMessageRepository';
import ChatDeletedEvent from '../../domain/events/ChatDeletedEvent';

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