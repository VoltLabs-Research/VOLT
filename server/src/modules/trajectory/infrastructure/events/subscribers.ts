import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import { MarkTrajectoryQueuedHandler } from '@modules/trajectory/application/events/MarkTrajectoryQueuedHandler';
import TeamDeletedEventHandler from '@modules/trajectory/application/events/TeamDeletedEventHandler';
import JobStatusChangedEventHandler from '@modules/trajectory/application/events/JobStatusChangedEventHandler';
import TrajectoryDeletedStorageCleanupEventHandler from '@modules/trajectory/application/events/TrajectoryDeletedStorageCleanupEventHandler';

export const trajectorySubscriberManifest: SubscriberManifest = {
    'PluginExecutionRequest': MarkTrajectoryQueuedHandler,
    'team.deleted': TeamDeletedEventHandler,
    'trajectory.deleted': TrajectoryDeletedStorageCleanupEventHandler,
    'job.status.changed': JobStatusChangedEventHandler
};
