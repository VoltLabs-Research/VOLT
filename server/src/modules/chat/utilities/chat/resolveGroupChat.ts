import { ErrorCodes } from '@core/constants/error-codes';
import Chat from '@modules/chat/domain/entities/chat/Chat';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';

export async function resolveGroupChat(
    chatRepo: IChatRepository,
    chatId: string,
    requesterId: string,
    requireAdmin: boolean = false
): Promise<Chat> {
    const chat = await resolveAccessibleChat(chatRepo, chatId, requesterId);

    if (!chat.props.isGroup) {
        throw ApplicationError.notFound(
            ErrorCodes.CHAT_NOT_FOUND,
            'Chat not found'
        );
    }

    if (requireAdmin && !chat.isAdmin(requesterId)) {
        throw ApplicationError.unauthorized(
            ErrorCodes.AUTH_UNAUTHORIZED,
            'Only admins can perform this action'
        );
    }

    return chat;
}
