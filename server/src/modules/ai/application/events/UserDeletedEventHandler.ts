import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import type { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('user.deleted')
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository) private readonly conversationRepository: IAIConversationRepository,
        @inject(AI_TOKENS.AIMessageRepository) private readonly messageRepository: IAIMessageRepository
    ) {}

    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        const conversations = await this.conversationRepository.export({
            filter: { userId },
            select: ['_id']
        });

        if (conversations.length === 0) {
            return;
        }

        const conversationIds = conversations.map((conversation) => conversation._id);

        await this.messageRepository.deleteMany({
            conversationId: { $in: conversationIds }
        });

        await this.conversationRepository.deleteMany({ userId });
    }
}
