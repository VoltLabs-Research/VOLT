import AIConversationModel from '@modules/ai/models/AIConversationModel';
import AIMessageModel from '@modules/ai/models/AIMessageModel';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

export default abstract class CascadeDeleteAIConversationsHandler<TEvent extends IDomainEvent>
    implements IEventHandler<TEvent> {
    
    protected abstract readonly ownerField: 'teamId' | 'userId';

    protected abstract resolveOwnerId(event: TEvent): string;

    async handle(event: TEvent): Promise<void> {
        const ownerId = this.resolveOwnerId(event);
        const filter = { [this.ownerField]: ownerId };

        const conversations = await AIConversationModel.find(filter).select('_id').exec();

        if (conversations.length === 0) {
            return;
        }

        const conversationIds = conversations.map((conversation) => conversation._id);

        await AIMessageModel.deleteMany({
            conversationId: { $in: conversationIds }
        });

        await AIConversationModel.deleteMany(filter);
    }
}
