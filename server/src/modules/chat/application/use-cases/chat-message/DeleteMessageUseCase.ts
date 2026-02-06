import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteMessageInputDTO } from '@modules/chat/application/dtos/chat-message/DeleteMessageDTO';

@injectable()
export class DeleteMessageUseCase implements IUseCase<DeleteMessageInputDTO, null, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ){}

    async execute(input: DeleteMessageInputDTO): Promise<Result<null, ApplicationError>> {
        const { messageId, userId } = input;
        const message = await this.messageRepo.findById(messageId);
        if (!message) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        if (!message.isSender(userId)) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.MESSAGE_FORBIDDEN,
                'Not owner'
            ));
        }

        await this.messageRepo.updateById(messageId, {
            deleted: true
        });

        return Result.ok(null);
    }
};