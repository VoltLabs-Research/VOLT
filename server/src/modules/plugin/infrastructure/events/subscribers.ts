import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import FirstTeamClusterConnectedEventHandler from '@modules/plugin/application/events/FirstTeamClusterConnectedEventHandler';
import TeamDeletedEventHandler from '@modules/plugin/application/events/TeamDeletedEventHandler';
import PluginDeletedEventHandler from '@modules/plugin/application/events/PluginDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/plugin/application/events/TrajectoryDeletedEventHandler';

export const pluginSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'team-cluster.first-connected': FirstTeamClusterConnectedEventHandler,
    'plugin.deleted': PluginDeletedEventHandler,
    'trajectory.deleted': TrajectoryDeletedEventHandler
};
