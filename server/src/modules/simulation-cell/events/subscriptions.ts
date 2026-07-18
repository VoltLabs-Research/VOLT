import SimulationCellRepository from '@modules/simulation-cell/repositories/SimulationCellRepository';
import { deleteManyOnTeamDeleted, deleteManyOnTrajectoryDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(SimulationCellRepository);
deleteManyOnTrajectoryDeleted(SimulationCellRepository);
