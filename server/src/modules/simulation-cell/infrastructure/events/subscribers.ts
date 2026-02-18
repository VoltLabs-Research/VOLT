import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/simulation-cell/application/events/TeamDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/simulation-cell/application/events/TrajectoryDeletedEventHandler';

export const registerSimulationCellSubscribers = (): Promise<void> =>
    registerSubscribers({
        'team.deleted': TeamDeletedEventHandler,
        'trajectory.deleted': TrajectoryDeletedEventHandler
    });
