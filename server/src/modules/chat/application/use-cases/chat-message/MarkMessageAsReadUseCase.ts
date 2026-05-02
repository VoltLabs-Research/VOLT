import { MarkMessageAsReadInputDTO } from '@modules/chat/application/dtos/chat-message/MarkMessageAsReadDTO';
import ChatMessageRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat-message/ChatMessageRepository';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class MarkMessageAsReadUseCase implements IUseCase<MarkMessageAsReadInputDTO, null, ApplicationError> {
    constructor(
        private messageRepo: ChatMessageRepository,
        private chatRepo: ChatRepository,
        private socketEmitter: SocketIOEmitter
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
