import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/simulation-cell/application/events/TeamDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/simulation-cell/application/events/TrajectoryDeletedEventHandler';

export const simulationCellSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'trajectory.deleted': TrajectoryDeletedEventHandler
};
