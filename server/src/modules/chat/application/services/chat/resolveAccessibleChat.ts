import { Result } from '@shared/domain/port/Result';
import { ErrorCodes } from '@core/constants/error-codes';
import { isParticipant } from '@modules/chat/application/services/chat/isParticipant';
import Chat from '@modules/chat/domain/entities/chat/Chat';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';

export async function resolveAccessibleChat(
    chatRepo: IChatRepository,
    chatId: string,
    requesterId: string
): Promise<Result<Chat, ApplicationError>> {
    const chat = await chatRepo.findById(chatId);

    if (!chat || !chat.props.isActive) {
        return Result.fail(ApplicationError.notFound(
            ErrorCodes.CHAT_NOT_FOUND,
            'Chat not found'
        ));
    }

    if (!isParticipant(chat, requesterId)) {
        return Result.fail(ApplicationError.unauthorized(
            ErrorCodes.AUTH_UNAUTHORIZED,
            'You are not a participant in this chat'
        ));
    }

    return Result.ok(chat);
}
