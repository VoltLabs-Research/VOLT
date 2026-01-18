import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';
import { EditMessageInputDTO, EditMessageOutputDTO } from '@modules/chat/application/dtos/chat-message/EditMessageDTO';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class EditMessageUseCase implements IUseCase<EditMessageInputDTO, EditMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository
    ){}

    async execute(input: EditMessageInputDTO): Promise<Result<EditMessageOutputDTO, ApplicationError>> {
        const { messageId, userId, content } = input;
        const message = await this.messageRepo.findById(messageId);
        if (!message) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        if (message.isSender(userId)) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Not owner'
            ));
        }

        const updatedMessage = await this.messageRepo.updateById(messageId, {
            content
        });

        if (!updatedMessage) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        return Result.ok(updatedMessage.props);
    }
};