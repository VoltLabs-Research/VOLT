import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import FirstTeamClusterConnectedEventHandler from '@modules/plugin/application/events/FirstTeamClusterConnectedEventHandler';
import TeamDeletedEventHandler from '@modules/plugin/application/events/TeamDeletedEventHandler';
import TeamCreatedEventHandler from '@modules/plugin/application/events/TeamCreatedEventHandler';
import PluginDeletedEventHandler from '@modules/plugin/application/events/PluginDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/plugin/application/events/TrajectoryDeletedEventHandler';

export const registerPluginSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'team.deleted': TeamDeletedEventHandler,
        'team.created': TeamCreatedEventHandler,
        'team-cluster.first-connected': FirstTeamClusterConnectedEventHandler,
        'plugin.deleted': PluginDeletedEventHandler,
        'trajectory.deleted': TrajectoryDeletedEventHandler
    });
};
