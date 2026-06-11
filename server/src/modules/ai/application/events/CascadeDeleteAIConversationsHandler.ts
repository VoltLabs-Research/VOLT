import type { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import type { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

/**
 * Cascade-deletes a conversation owner's data across both collections:
 * first the messages of every affected conversation, then the conversations
 * themselves. The shared single-collection cascade bases can't express this
 * two-collection chain, so the AI module owns this base. Subclasses only
 * declare which payload field scopes the deletion (e.g. `teamId`, `userId`).
 */
export default abstract class CascadeDeleteAIConversationsHandler<TEvent extends IDomainEvent>
    implements IEventHandler<TEvent> {

    protected abstract readonly conversationRepository: IAIConversationRepository;
    protected abstract readonly messageRepository: IAIMessageRepository;

    /** The field on `{ teamId, userId }` that this handler filters conversations by. */
    protected abstract readonly ownerField: 'teamId' | 'userId';

    protected abstract resolveOwnerId(event: TEvent): string;

    async handle(event: TEvent): Promise<void> {
        const ownerId = this.resolveOwnerId(event);
        const filter = { [this.ownerField]: ownerId };

        const conversations = await this.conversationRepository.export({
            filter,
            select: ['_id']
        });

        if (conversations.length === 0) {
            return;
        }

        const conversationIds = conversations.map((conversation) => conversation._id);

        await this.messageRepository.deleteMany({
            conversationId: { $in: conversationIds }
        });

        await this.conversationRepository.deleteMany(filter);
    }
}
