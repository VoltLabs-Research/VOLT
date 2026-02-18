import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import { UserDeletedEventHandler } from '@modules/api-tracker/application/events/UserDeletedEventHandler';

export const registerApiTrackerSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'user.deleted': UserDeletedEventHandler
    });
};
