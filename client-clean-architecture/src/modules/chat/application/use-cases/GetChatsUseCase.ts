import type { IChatRepository } from '../../domain/repositories/IChatRepository';
import type { Chat } from '../../domain/entities';

export class GetChatsUseCase {
    constructor(private readonly chatRepository: IChatRepository) {}

    async execute(): Promise<Chat[]> {
        return this.chatRepository.getChats();
    }
}
