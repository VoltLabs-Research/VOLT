import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { inject, injectable } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';

@injectable()
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private readonly repository: IChatRepository
    ) {}

    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;

        await this.repository.removeUserReferences(userId);

        const orphanedChatIds = await this.repository.findIdsWithEmptyParticipants();
        for (const chatId of orphanedChatIds) {
            try {
                await this.repository.deleteById(chatId);
            } catch (error) {
                logger.warn(
                    { err: error, chatId, userId },
                    '@chat/user-deleted: failed to delete empty chat'
                );
            }
        }
    }
};
