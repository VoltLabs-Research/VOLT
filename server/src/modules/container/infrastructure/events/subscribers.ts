import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import { TeamDeletedEventHandler } from '@modules/container/application/events/TeamDeletedEventHandler';

export const registerContainerSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'team.deleted': TeamDeletedEventHandler
    });
};
