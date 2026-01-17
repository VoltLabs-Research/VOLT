import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import TeamDeletedEventHandler from '../../application/events/TeamDeletedEventHandler';
import AnalysisDeletedEventHandler from '../../application/events/AnalysisDeletedEventHandler';
import TrajectoryDeletedEventHandler from '../../application/events/TrajectoryDeletedEventHandler';

export const registerAnalysisSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const analysisDeletedHandler = container.resolve(AnalysisDeletedEventHandler);
    const trajectoryDeletedHandler = container.resolve(TrajectoryDeletedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('analysis.deleted', analysisDeletedHandler);
    await eventBus.subscribe('trajectory.deleted', trajectoryDeletedHandler);
};
