import CascadeDeleteAIConversationsHandler from '@modules/ai/events/CascadeDeleteAIConversationsHandler';
import UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class UserDeletedEventHandler extends CascadeDeleteAIConversationsHandler<UserDeletedEvent> {
    protected readonly ownerField = 'userId' as const;

    protected resolveOwnerId(event: UserDeletedEvent): string {
        return event.payload.userId;
    }
}

const userDeletedEventHandler = new UserDeletedEventHandler();
subscribeHandler('user.deleted', userDeletedEventHandler);

export default userDeletedEventHandler;
