import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { GetChatMessagesInputDTO, GetChatMessagesOutputDTO } from '@modules/chat/application/dtos/chat-message/GetChatMessagesDTO';
import { resolveAccessibleChat } from '@modules/chat/application/helpers/resolveAccessibleChat';
import { toPersistedChatOutput } from '@modules/chat/application/helpers/toPersistedChatOutput';


@injectable()
export class GetChatMessagesUseCase implements IUseCase<GetChatMessagesInputDTO, GetChatMessagesOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: GetChatMessagesInputDTO): Promise<Result<GetChatMessagesOutputDTO, ApplicationError>> {
        const { chatId } = input;

        const chatResult = await resolveAccessibleChat(this.chatRepo, chatId, input.userId);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }

        const messages = await this.messageRepo.findAll({
            filter: { chat: chatId },
            limit: input.limit,
            page: input.page,
            populate: 'sender',
            sort: { createdAt: 1 }
        });
        return Result.ok({
            ...messages,
            data: messages.data.map((message) => toPersistedChatOutput(message))
        });
    }
};
