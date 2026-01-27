import type { IChatRepository } from '../../domain/repositories/IChatRepository';
import type { Message } from '../../domain/entities';

export class GetChatMessagesUseCase {
    constructor(private readonly chatRepository: IChatRepository) {}

    async execute(chatId: string, page?: number, limit?: number): Promise<Message[]> {
        return this.chatRepository.getChatMessages(chatId, page, limit);
    }
}
