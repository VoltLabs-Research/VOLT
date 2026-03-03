import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/ssh/application/events/TeamDeletedEventHandler';
import UserDeletedEventHandler from '@modules/ssh/application/events/UserDeletedEventHandler';

export const registerSSHSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'team.deleted': TeamDeletedEventHandler,
        'user.deleted': UserDeletedEventHandler
    });
};
