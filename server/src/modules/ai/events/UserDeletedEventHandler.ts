import CascadeDeleteAIConversationsHandler from '@modules/ai/events/CascadeDeleteAIConversationsHandler';
import UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('user.deleted')
export default class UserDeletedEventHandler extends CascadeDeleteAIConversationsHandler<UserDeletedEvent> {
    protected readonly ownerField = 'userId' as const;

    protected resolveOwnerId(event: UserDeletedEvent): string {
        return event.payload.userId;
    }
}
