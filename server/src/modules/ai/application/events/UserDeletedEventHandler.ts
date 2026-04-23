import AIConversationRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIConversationRepository';
import AIMessageRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIMessageRepository';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('user.deleted')
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    constructor(
        
        private readonly conversationRepository: AIConversationRepository,

        
        private readonly messageRepository: AIMessageRepository
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
};
