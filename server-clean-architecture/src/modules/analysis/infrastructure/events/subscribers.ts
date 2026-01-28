import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEventHandler from '@modules/analysis/application/events/TeamDeletedEventHandler';
import AnalysisDeletedEventHandler from '@modules/analysis/application/events/AnalysisDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/analysis/application/events/TrajectoryDeletedEventHandler';
import AnalysisCreatedEventHandler from '@modules/analysis/application/events/AnalysisCreatedEventHandler';

export const registerAnalysisSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const analysisDeletedHandler = container.resolve(AnalysisDeletedEventHandler);
    const trajectoryDeletedHandler = container.resolve(TrajectoryDeletedEventHandler);
    const analysisCreatedHandler = container.resolve(AnalysisCreatedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('analysis.deleted', analysisDeletedHandler);
    await eventBus.subscribe('trajectory.deleted', trajectoryDeletedHandler);
    await eventBus.subscribe('analysis.created', analysisCreatedHandler);
};
