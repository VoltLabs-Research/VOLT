import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';
import { MarkMessageAsReadInputDTO } from '@modules/chat/application/dtos/chat-message/MarkMessageAsReadDTO';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { resolveAccessibleChat } from '@modules/chat/application/helpers/resolveAccessibleChat';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

@injectable()
export class MarkMessageAsReadUseCase implements IUseCase<MarkMessageAsReadInputDTO, null, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository,
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private socketEmitter: ISocketEmitter
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
};
