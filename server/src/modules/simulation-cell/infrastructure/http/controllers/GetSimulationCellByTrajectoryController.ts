import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetSimulationCellByTrajectoryUseCase from '@modules/simulation-cell/application/use-cases/GetSimulationCellByTrajectoryUseCase';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';

const GetSimulationCellByTrajectoryController = createController(
    GetSimulationCellByTrajectoryUseCase,
    { validationSchema: simulationCellValidationSchemas.getByTrajectory }
);

export default GetSimulationCellByTrajectoryController;
