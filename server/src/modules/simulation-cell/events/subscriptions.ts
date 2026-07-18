import SimulationCellRepositoryAdapter from '@modules/simulation-cell/services/SimulationCellRepositoryAdapter';
import { deleteManyOnTeamDeleted, deleteManyOnTrajectoryDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

const simulationCellRepositoryAdapter = new SimulationCellRepositoryAdapter();

deleteManyOnTeamDeleted(simulationCellRepositoryAdapter);
deleteManyOnTrajectoryDeleted(simulationCellRepositoryAdapter);
