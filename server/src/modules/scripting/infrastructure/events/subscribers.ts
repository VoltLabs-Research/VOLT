import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/scripting/application/events/TeamDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/scripting/application/events/TrajectoryDeletedEventHandler';

export const registerScriptingSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'team.deleted': TeamDeletedEventHandler,
        'trajectory.deleted': TrajectoryDeletedEventHandler
    });
};
