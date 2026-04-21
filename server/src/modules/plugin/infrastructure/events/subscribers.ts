import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import FirstTeamClusterConnectedEventHandler from '@modules/plugin/application/events/FirstTeamClusterConnectedEventHandler';
import TeamDeletedEventHandler from '@modules/plugin/application/events/TeamDeletedEventHandler';
import PluginDeletedEventHandler from '@modules/plugin/application/events/PluginDeletedEventHandler';
import PluginPublishedEventHandler from '@modules/plugin/application/events/PluginPublishedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/plugin/application/events/TrajectoryDeletedEventHandler';

export const pluginSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'team-cluster.first-connected': FirstTeamClusterConnectedEventHandler,
    'plugin.deleted': PluginDeletedEventHandler,
    'plugin.published': PluginPublishedEventHandler,
    'trajectory.deleted': TrajectoryDeletedEventHandler
};
