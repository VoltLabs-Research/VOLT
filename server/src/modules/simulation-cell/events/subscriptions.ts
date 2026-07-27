import SimulationCellModel from '@modules/simulation-cell/models/SimulationCellModel';
import { deleteManyOnTeamDeleted, deleteManyOnTrajectoryDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(SimulationCellModel);
deleteManyOnTrajectoryDeleted(SimulationCellModel);
