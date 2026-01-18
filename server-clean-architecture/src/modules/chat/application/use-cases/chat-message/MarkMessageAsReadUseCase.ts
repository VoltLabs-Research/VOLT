import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';
import { MarkMessagesAsReadInputDTO } from '@modules/chat/application/dtos/chat-message/MarkMessageAsReadDTO';

@injectable()
export class MarkMessagesAsReadUseCase implements IUseCase<MarkMessagesAsReadInputDTO, null, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ) { }

    async execute(input: MarkMessagesAsReadInputDTO): Promise<Result<null, ApplicationError>> {
        const { chatId, userId } = input;
        await this.messageRepo.markMessageAsRead(chatId, userId);
        return Result.ok(null);
    }
};