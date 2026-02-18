import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/daily-activity/application/events/TeamDeletedEventHandler';
import LogPluginExecutionRequestHandler from '@modules/daily-activity/application/events/LogPluginExecutionRequestHandler';
import TrajectoryCreatedEventHandler from '@modules/daily-activity/application/events/TrajectoryCreatedEventHandler';

export const registerDailyActivitySubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'team.deleted': TeamDeletedEventHandler,
        'PluginExecutionRequest': LogPluginExecutionRequestHandler,
        'trajectory.created': TrajectoryCreatedEventHandler
    });
};
