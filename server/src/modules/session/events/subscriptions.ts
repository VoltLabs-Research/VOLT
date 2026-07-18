import SessionModel from '@modules/session/models/SessionModel';
import { subscribeHandlerClass } from '@shared/infrastructure/events/Subscribe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';

class SessionsDeletedOnUserDeletedHandler implements IEventHandler<UserDeletedEvent> {
    async handle(event: UserDeletedEvent): Promise<void> {
        await SessionModel.deleteMany({ user: event.payload.userId });
    }
}

subscribeHandlerClass('user.deleted', SessionsDeletedOnUserDeletedHandler);
