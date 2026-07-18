import SimulationCellRepositoryAdapter from '@modules/simulation-cell/services/SimulationCellRepositoryAdapter';
import { deleteManyOnTeamDeleted, deleteManyOnTrajectoryDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(SimulationCellRepositoryAdapter);
deleteManyOnTrajectoryDeleted(SimulationCellRepositoryAdapter);
