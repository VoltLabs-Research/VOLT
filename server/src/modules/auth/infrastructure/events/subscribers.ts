import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/auth/application/events/TeamDeletedEventHandler';

export const registerAuthSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'team.deleted': TeamDeletedEventHandler
    });
};
