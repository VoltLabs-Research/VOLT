import GetSimulationCellByIdController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByIdController';
import GetSimulationCellByTrajectoryController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByTrajectoryController';
import ListSimulationCellsByTeamIdController from '@modules/simulation-cell/infrastructure/http/controllers/ListSimulationCellsByTeamIdController';
import { container } from 'tsyringe';

export default {
    getById: container.resolve(GetSimulationCellByIdController),
    getByTrajectory: container.resolve(GetSimulationCellByTrajectoryController),
    listByTeamId: container.resolve(ListSimulationCellsByTeamIdController)
};
