import { GetChatMessagesInputDTO } from '@modules/chat/application/dtos/chat-message/GetChatMessagesDTO';
import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import type { IChatMessageRepository } from '@modules/chat/domain/port/chat-message/IChatMessageRepository';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import type { FindOptions, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface GetChatMessagesFilter {
    chat: string;
}

interface GetChatMessagesSort extends Record<string, 1 | -1> {
    createdAt: 1;
}

interface GetChatMessagesFindOptions extends FindOptions<GetChatMessagesFilter>, PaginationOptions {
    filter: GetChatMessagesFilter;
    sort: GetChatMessagesSort;
}


@injectable()
export class GetChatMessagesUseCase implements IUseCase<GetChatMessagesInputDTO, PaginatedResult<PersistedChatMessageDTO>, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository
    ){}

    async execute(input: GetChatMessagesInputDTO): Promise<Result<PaginatedResult<PersistedChatMessageDTO>, ApplicationError>> {
        const { chatId } = input;
        const options: GetChatMessagesFindOptions = {
            filter: {
                chat: chatId
            },
            limit: input.limit,
            page: input.page,
            populate: 'sender',
            sort: {
                createdAt: 1
            }
        };

        const chatResult = await resolveAccessibleChat(this.chatRepo, chatId, input.userId);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }

        const messages = await this.messageRepo.findAll(options);
        return Result.ok({
            ...messages,
            data: messages.data.map((message) => toPersistedEntity(message))
        });
    }
}
