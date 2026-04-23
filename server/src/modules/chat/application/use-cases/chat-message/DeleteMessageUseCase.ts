import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteMessageInputDTO } from '@modules/chat/application/dtos/chat-message/DeleteMessageDTO';
import ChatMessageRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat-message/ChatMessageRepository';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class DeleteMessageUseCase implements IUseCase<DeleteMessageInputDTO, null, ApplicationError> {
    constructor(
        
        private messageRepo: ChatMessageRepository,
        
        private socketEmitter: SocketIOEmitter
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

        this.socketEmitter.emitToRoom(`chat-${input.chatId}`, 'message_deleted', {
            chatId: input.chatId,
            messageId
        });

        return Result.ok(null);
    }
};
