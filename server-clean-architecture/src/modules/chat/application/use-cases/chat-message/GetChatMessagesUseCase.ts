import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';
import { GetChatMessagesInputDTO, GetChatMessagesOutputDTO } from '@modules/chat/application/dtos/chat-message/GetChatMessagesDTO';

@injectable()
@injectable()
export class GetChatMessagesUseCase implements IUseCase<GetChatMessagesInputDTO, GetChatMessagesOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ) { }

    async execute(input: GetChatMessagesInputDTO): Promise<Result<GetChatMessagesOutputDTO, ApplicationError>> {
        // TODO: verify chat access
        const { chatId } = input;
        const messages = await this.messageRepo.findAll({
            filter: { chat: chatId },
            limit: 100,
            page: 1,
            populate: 'sender'
        });
        return Result.ok({
            ...messages,
            data: messages.data.map(m => m.props)
        });
    }
};