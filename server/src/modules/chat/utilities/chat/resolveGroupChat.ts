import { Result } from '@shared/domain/port/Result';
import { ErrorCodes } from '@core/constants/error-codes';
import Chat from '@modules/chat/domain/entities/chat/Chat';
import { resolveAccessibleChat } from '@modules/chat/utilities/chat/resolveAccessibleChat';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';

export async function resolveGroupChat(
    chatRepo: IChatRepository,
    chatId: string,
    requesterId: string,
    requireAdmin: boolean = false
): Promise<Result<Chat, ApplicationError>> {
    const chatResult = await resolveAccessibleChat(chatRepo, chatId, requesterId);

    if (!chatResult.success) {
        return Result.fail(chatResult.error!);
    }

    const chat = chatResult.value!;

    if (!chat.props.isGroup) {
        return Result.fail(ApplicationError.notFound(
            ErrorCodes.CHAT_NOT_FOUND,
            'Chat not found'
        ));
    }

    if (requireAdmin && !chat.isAdmin(requesterId)) {
        return Result.fail(ApplicationError.unauthorized(
            ErrorCodes.AUTH_UNAUTHORIZED,
            'Only admins can perform this action'
        ));
    }

    return Result.ok(chat);
}
