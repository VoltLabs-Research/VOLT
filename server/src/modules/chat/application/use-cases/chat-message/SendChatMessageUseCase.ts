import { SendChatMessageInputDTO, SendChatMessageOutputDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import type { IChatMessageRepository } from '@modules/chat/domain/port/chat-message/IChatMessageRepository';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class SendChatMessageUseCase implements IUseCase<SendChatMessageInputDTO, SendChatMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository,
        @inject(SOCKET_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
    ){}

    async execute(input: SendChatMessageInputDTO): Promise<Result<SendChatMessageOutputDTO, ApplicationError>> {
        const { userId, chatId, content, messageType, metadata } = input;

        const chatResult = await resolveAccessibleChat(this.chatRepo, chatId, userId);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }

        const message = await this.messageRepo.create({
            chat: chatId,
            sender: userId,
            content,
            messageType,
            metadata,
            readBy: [input.userId],
            reactions: [],
            deleted: false,
            createdAt: new Date()
        });

        await this.chatRepo.updateLastMessage(chatId, message._id);

        const persistedMessage = toPersistedEntity(message);

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'new_message', {
            message: persistedMessage,
            chatId
        });

        return Result.ok(persistedMessage);
    }
}
