import { inject, injectable } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveAccessibleChat } from '@modules/chat/application/helpers/resolveAccessibleChat';
import type { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class ChatSocketAccessPolicy {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private readonly chatRepository: IChatRepository
    ) {}

    async validate(userId: string, chatId: string): Promise<ApplicationError | null> {
        try {
            const chatResult = await resolveAccessibleChat(this.chatRepository, chatId, userId);

            if (!chatResult.success) {
                if (chatResult.error) {
                    return chatResult.error;
                }

                return ApplicationError.notFound(
                    ErrorCodes.CHAT_NOT_FOUND,
                    'Chat not found'
                );
            }

            return null;
        } catch (error) {
            logger.error(`@chat-socket - checkChatAccess error: ${error}`);

            return ApplicationError.internalServerError('Failed to validate chat access');
        }
    }
}
