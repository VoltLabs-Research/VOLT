import ChatService from '@modules/chat/services/ChatService';
import type UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

/**
 * Removes a deleted user from every chat and cleans up chats left empty.
 * Delegates to {@link ChatService} (the chat repository layer was removed in
 * the pollium conversion).
 */
class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    #service = new ChatService();

    async handle(event: UserDeletedEvent): Promise<void> {
        await this.#service.removeUserFromAllChats(event.payload.userId);
    }
}

const userDeletedEventHandler = new UserDeletedEventHandler();
subscribeHandler('user.deleted', userDeletedEventHandler);

export default userDeletedEventHandler;
