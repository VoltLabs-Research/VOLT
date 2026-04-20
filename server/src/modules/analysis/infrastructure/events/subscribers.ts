import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/analysis/application/events/TeamDeletedEventHandler';
import AnalysisDeletedEventHandler from '@modules/analysis/application/events/AnalysisDeletedEventHandler';
import AnalysisDeletedDaemonListingPurgeEventHandler from '@modules/analysis/application/events/AnalysisDeletedDaemonListingPurgeEventHandler';
import AnalysisDeletedStorageCleanupEventHandler from '@modules/analysis/application/events/AnalysisDeletedStorageCleanupEventHandler';
import TrajectoryDeletedEventHandler from '@modules/analysis/application/events/TrajectoryDeletedEventHandler';

export const analysisSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'analysis.deleted': [
        AnalysisDeletedEventHandler,
        AnalysisDeletedStorageCleanupEventHandler,
        AnalysisDeletedDaemonListingPurgeEventHandler
    ],
    'trajectory.deleted': TrajectoryDeletedEventHandler
};
