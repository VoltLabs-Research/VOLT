import { ErrorCodes } from '@core/constants/error-codes';
import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import { ToggleMessageReactionInputDTO } from '@modules/chat/application/dtos/chat-message/ToggleMessageReactionDTO';
import ChatMessageRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat-message/ChatMessageRepository';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class ToggleMessageReactionUseCase implements IUseCase<ToggleMessageReactionInputDTO, PersistedChatMessageDTO, ApplicationError> {
    constructor(
        private messageRepo: ChatMessageRepository,
        private chatRepo: ChatRepository,
        private socketEmitter: SocketIOEmitter
    ){}

    async execute(input: ToggleMessageReactionInputDTO): Promise<Result<PersistedChatMessageDTO, ApplicationError>> {
        const { emoji, messageId, userId } = input;
        const message = await this.messageRepo.findById(messageId);
        if (!message) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Message not found'
            ));
        }

        const chatResult = await resolveAccessibleChat(this.chatRepo, String(message.props.chat), userId);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }

        message.toggleReaction(userId, emoji);
        const updatedMessage = await this.messageRepo.updateById(messageId, {
            reactions: message.props.reactions
        }, { populate: 'sender' });

        if (!updatedMessage) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        const persistedMessage = toPersistedEntity(updatedMessage);

        this.socketEmitter.emitToRoom(`chat-${input.chatId}`, 'reaction_updated', {
            chatId: input.chatId,
            message: persistedMessage
        });

        return Result.ok(persistedMessage);
    }
}
