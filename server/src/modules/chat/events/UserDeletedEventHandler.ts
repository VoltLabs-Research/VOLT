import ChatService from '@modules/chat/services/ChatService';
import type UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    #service = new ChatService();

    async handle(event: UserDeletedEvent): Promise<void> {
        await this.#service.removeUserFromAllChats(event.payload.userId);
    }
}

const userDeletedEventHandler = new UserDeletedEventHandler();
subscribeHandler('user.deleted', userDeletedEventHandler);

export default userDeletedEventHandler;
