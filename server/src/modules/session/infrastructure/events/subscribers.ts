import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import UserDeletedEventHandler from '@modules/session/application/events/UserDeletedEventHandler';

export const registerSessionSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'user.deleted': UserDeletedEventHandler
    });
};
