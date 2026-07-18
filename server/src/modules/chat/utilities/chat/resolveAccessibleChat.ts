import { ErrorCodes } from '@core/constants/error-codes';
import { isParticipant } from '@modules/chat/utilities/chat/isParticipant';
import Chat from '@modules/chat/entities/chat/Chat';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IChatRepository } from '@modules/chat/ports/chat/IChatRepository';

export async function resolveAccessibleChat(
    chatRepo: IChatRepository,
    chatId: string,
    requesterId: string
): Promise<Chat> {
    const chat = await chatRepo.findById(chatId);

    if (!chat || !chat.props.isActive) {
        throw ApplicationError.notFound(
            ErrorCodes.CHAT_NOT_FOUND,
            'Chat not found'
        );
    }

    if (!isParticipant(chat, requesterId)) {
        throw ApplicationError.unauthorized(
            ErrorCodes.AUTH_UNAUTHORIZED,
            'You are not a participant in this chat'
        );
    }

    return chat;
}
