import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetSimulationCellByTrajectoryUseCase from '@modules/simulation-cell/application/use-cases/GetSimulationCellByTrajectoryUseCase';

const GetSimulationCellByTrajectoryController = createController(GetSimulationCellByTrajectoryUseCase);

export default GetSimulationCellByTrajectoryController;
