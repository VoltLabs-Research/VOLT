import { ToggleMessageReactionInputDTO, ToggleMessageReactionOutputDTO } from '@modules/chat/application/dtos/chat-message/ToggleMessageReactionDTO';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import { toPersistedChatOutput } from '@modules/chat/utilities/toPersistedChatOutput';
import { ErrorCodes } from '@core/constants/error-codes';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IChatMessageRepository } from '@modules/chat/domain/port/chat-message/IChatMessageRepository';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

@injectable()
export class ToggleMessageReactionUseCase implements IUseCase<ToggleMessageReactionInputDTO, ToggleMessageReactionOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private socketEmitter: ISocketEmitter
    ){}

    async execute(input: ToggleMessageReactionInputDTO): Promise<Result<ToggleMessageReactionOutputDTO, ApplicationError>> {
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

        const persistedMessage = toPersistedChatOutput(updatedMessage);

        this.socketEmitter.emitToRoom(`chat-${input.chatId}`, 'reaction_updated', {
            chatId: input.chatId,
            message: persistedMessage
        });

        return Result.ok(persistedMessage);
    }
};
