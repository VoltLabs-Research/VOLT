import { GetChatMessagesInputDTO } from '@modules/chat/application/dtos/chat-message/GetChatMessagesDTO';
import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import type { IChatMessageRepository } from '@modules/chat/domain/port/chat-message/IChatMessageRepository';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetChatMessagesUseCase implements IUseCase<GetChatMessagesInputDTO, PaginatedResult<PersistedChatMessageDTO>> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository
    ){}

    async execute(input: GetChatMessagesInputDTO): Promise<PaginatedResult<PersistedChatMessageDTO>> {
        const { chatId } = input;
        const options = {
            filter: {
                chat: chatId
            },
            limit: input.limit,
            page: input.page,
            populate: 'sender',
            sort: {
                createdAt: 1
            }
        } as const;

        await resolveAccessibleChat(this.chatRepo, chatId, input.userId);

        const messages = await this.messageRepo.findAll(options);
        return {
            ...messages,
            data: messages.data.map((message) => toPersistedEntity(message))
        };
    }
}
