import { GetChatMessagesInputDTO } from '@modules/chat/application/dtos/chat-message/GetChatMessagesDTO';
import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import ChatMessageRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat-message/ChatMessageRepository';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import type { FindOptions, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

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
        private messageRepo: ChatMessageRepository,
        private chatRepo: ChatRepository
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
