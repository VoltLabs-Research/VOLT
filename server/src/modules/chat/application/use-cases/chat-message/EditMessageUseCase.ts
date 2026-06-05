import { ErrorCodes } from '@core/constants/error-codes';
import { EditMessageInputDTO } from '@modules/chat/application/dtos/chat-message/EditMessageDTO';
import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import type { IChatMessageRepository } from '@modules/chat/domain/port/chat-message/IChatMessageRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class EditMessageUseCase implements IUseCase<EditMessageInputDTO, PersistedChatMessageDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly messageRepo: IChatMessageRepository,
        @inject(SOCKET_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
    ){}

    async execute(input: EditMessageInputDTO): Promise<Result<PersistedChatMessageDTO, ApplicationError>> {
        const { messageId, userId, content } = input;
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

        const updatedMessage = await this.messageRepo.updateById(messageId, {
            content
        }, { populate: 'sender' });

        if (!updatedMessage) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        const persistedMessage = toPersistedEntity(updatedMessage);

        this.socketEmitter.emitToRoom(`chat-${input.chatId}`, 'message_edited', {
            chatId: input.chatId,
            message: persistedMessage
        });

        return Result.ok(persistedMessage);
    }
}
