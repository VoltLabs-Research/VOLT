import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import { deleteManyOnTeamDeleted, deleteManyOnTrajectoryDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(SimulationCellRepository);
deleteManyOnTrajectoryDeleted(SimulationCellRepository);
