import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { SendChatMessageInputDTO, SendChatMessageOutputDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';
import { resolveAccessibleChat } from '@modules/chat/application/helpers/resolveAccessibleChat';
import { toPersistedChatOutput } from '@modules/chat/application/helpers/toPersistedChatOutput';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

@injectable()
export class SendChatMessageUseCase implements IUseCase<SendChatMessageInputDTO, SendChatMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private socketEmitter: ISocketEmitter
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

        const persistedMessage = toPersistedChatOutput(message);

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'new_message', {
            message: persistedMessage,
            chatId
        });

        return Result.ok(persistedMessage);
    }
};
