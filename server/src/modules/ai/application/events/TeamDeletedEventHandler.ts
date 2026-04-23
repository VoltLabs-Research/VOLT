import AIConversationRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIConversationRepository';
import AIMessageRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIMessageRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        
        private readonly conversationRepository: AIConversationRepository,

        
        private readonly messageRepository: AIMessageRepository
    ) {}

    async handle(event: TeamDeletedEvent): Promise<void> {
        const { teamId } = event.payload;
        const conversations = await this.conversationRepository.export({
            filter: { teamId },
            select: ['_id']
        });

        if (conversations.length === 0) {
            return;
        }

        const conversationIds = conversations.map((conversation) => conversation._id);

        await this.messageRepository.deleteMany({
            conversationId: { $in: conversationIds }
        });

        await this.conversationRepository.deleteMany({ teamId });
    }
};
