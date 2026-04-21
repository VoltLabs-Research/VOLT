import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import {
    deleteManyOnTeamDeletedHandler,
    deleteManyOnTrajectoryDeletedHandler
} from '@shared/application/events/cascadeDeleteHandlerFactories';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';

const TeamDeletedEventHandler = deleteManyOnTeamDeletedHandler(SIMULATION_CELL_TOKENS.SimulationCellRepository);
const TrajectoryDeletedEventHandler = deleteManyOnTrajectoryDeletedHandler(SIMULATION_CELL_TOKENS.SimulationCellRepository);

export const simulationCellSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'trajectory.deleted': TrajectoryDeletedEventHandler
};
