import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/analysis/application/events/TeamDeletedEventHandler';
import AnalysisDeletedEventHandler from '@modules/analysis/application/events/AnalysisDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/analysis/application/events/TrajectoryDeletedEventHandler';
import AnalysisCreatedEventHandler from '@modules/analysis/application/events/AnalysisCreatedEventHandler';

export const registerAnalysisSubscribers = (): Promise<void> =>
    registerSubscribers({
        'team.deleted': TeamDeletedEventHandler,
        'analysis.deleted': AnalysisDeletedEventHandler,
        'trajectory.deleted': TrajectoryDeletedEventHandler,
        'analysis.created': AnalysisCreatedEventHandler
    });
