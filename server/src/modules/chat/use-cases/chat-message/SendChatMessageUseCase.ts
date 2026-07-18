import { SendChatMessageInputDTO, SendChatMessageOutputDTO } from '@modules/chat/dtos/chat-message/SendChatMessageDTO';
import type { IChatMessageRepository } from '@modules/chat/ports/chat-message/IChatMessageRepository';
import type { IChatRepository } from '@modules/chat/ports/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/di/ChatTokens';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import type { ISocketEmitter } from '@modules/socket/ports/ISocketEmitter';
import { SOCKET_CONTRACT_TOKENS } from '@shared/contracts/tokens/SocketTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class SendChatMessageUseCase implements IUseCase<SendChatMessageInputDTO, SendChatMessageOutputDTO> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository,
        @inject(SOCKET_CONTRACT_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
    ){}

    async execute(input: SendChatMessageInputDTO): Promise<SendChatMessageOutputDTO> {
        const { userId, chatId, content, messageType, metadata } = input;

        await resolveAccessibleChat(this.chatRepo, chatId, userId);

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

        return persistedMessage;
    }
}
