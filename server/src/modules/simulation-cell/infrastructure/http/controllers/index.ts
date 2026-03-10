import GetSimulationCellByIdController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByIdController';
import GetSimulationCellByTrajectoryController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByTrajectoryController';
import ListSimulationCellsByTeamIdController from '@modules/simulation-cell/infrastructure/http/controllers/ListSimulationCellsByTeamIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    getById: GetSimulationCellByIdController,
    getByTrajectory: GetSimulationCellByTrajectoryController,
    listByTeamId: ListSimulationCellsByTeamIdController
});