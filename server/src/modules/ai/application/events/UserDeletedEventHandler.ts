import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import CascadeDeleteAIConversationsHandler from '@modules/ai/application/events/CascadeDeleteAIConversationsHandler';
import type { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import type { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('user.deleted')
export default class UserDeletedEventHandler extends CascadeDeleteAIConversationsHandler<UserDeletedEvent> {
    protected readonly ownerField = 'userId' as const;

    constructor(
        @inject(AI_TOKENS.AIConversationRepository) protected readonly conversationRepository: IAIConversationRepository,
        @inject(AI_TOKENS.AIMessageRepository) protected readonly messageRepository: IAIMessageRepository
    ) {
        super();
    }

    protected resolveOwnerId(event: UserDeletedEvent): string {
        return event.payload.userId;
    }
}
