import type { IChatRepository } from '../../domain/repositories/IChatRepository';
import type { Message } from '../../domain/entities';

export class SendMessageUseCase {
    constructor(private readonly chatRepository: IChatRepository) {}

    async execute(chatId: string, content: string, messageType?: string, metadata?: any): Promise<Message> {
        return this.chatRepository.sendMessage(chatId, content, messageType, metadata);
    }
}
