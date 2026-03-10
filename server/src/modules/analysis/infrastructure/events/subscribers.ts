import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/analysis/application/events/TeamDeletedEventHandler';
import AnalysisDeletedEventHandler from '@modules/analysis/application/events/AnalysisDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/analysis/application/events/TrajectoryDeletedEventHandler';

export const analysisSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'analysis.deleted': AnalysisDeletedEventHandler,
    'trajectory.deleted': TrajectoryDeletedEventHandler
};
