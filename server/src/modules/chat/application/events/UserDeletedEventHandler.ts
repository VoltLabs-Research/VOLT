import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import type ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import type UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import { inject } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe('user.deleted')
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository) private readonly repository: ChatRepository
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
}
