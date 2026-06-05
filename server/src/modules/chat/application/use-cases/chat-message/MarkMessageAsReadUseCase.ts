import { MarkMessageAsReadInputDTO } from '@modules/chat/application/dtos/chat-message/MarkMessageAsReadDTO';
import type { IChatMessageRepository } from '@modules/chat/domain/port/chat-message/IChatMessageRepository';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class MarkMessageAsReadUseCase implements IUseCase<MarkMessageAsReadInputDTO, null, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository) private readonly messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository,
        @inject(SOCKET_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
    ){}

    async execute(input: MarkMessageAsReadInputDTO): Promise<Result<null, ApplicationError>> {
        const { chatId, userId } = input;

        const chatResult = await resolveAccessibleChat(this.chatRepo, chatId, userId);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }

        await this.messageRepo.markAllAsRead(chatId, userId);

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'messages_read', {
            chatId,
            readBy: userId,
            readAt: new Date()
        });

        return Result.ok(null);
    }
}
