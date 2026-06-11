import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import CascadeDeleteAIConversationsHandler from '@modules/ai/application/events/CascadeDeleteAIConversationsHandler';
import type { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import type { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteAIConversationsHandler<TeamDeletedEvent> {
    protected readonly ownerField = 'teamId' as const;

    constructor(
        @inject(AI_TOKENS.AIConversationRepository) protected readonly conversationRepository: IAIConversationRepository,
        @inject(AI_TOKENS.AIMessageRepository) protected readonly messageRepository: IAIMessageRepository
    ) {
        super();
    }

    protected resolveOwnerId(event: TeamDeletedEvent): string {
        return event.payload.teamId;
    }
}
