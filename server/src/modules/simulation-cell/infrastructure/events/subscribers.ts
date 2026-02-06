import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEventHandler from '@modules/simulation-cell/application/events/TeamDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/simulation-cell/application/events/TrajectoryDeletedEventHandler';

export const registerSimulationCellSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const trajectoryDeletedHandler = container.resolve(TrajectoryDeletedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('trajectory.deleted', trajectoryDeletedHandler);
};
