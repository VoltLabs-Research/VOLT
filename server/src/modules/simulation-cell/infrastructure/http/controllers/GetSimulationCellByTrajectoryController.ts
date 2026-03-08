import { createController } from '@shared/infrastructure/http/controllers/createController';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';

const GetSimulationCellByTrajectoryController = createController(
    SIMULATION_CELL_TOKENS.GetSimulationCellByTrajectoryUseCase,
    { validationSchema: simulationCellValidationSchemas.getByTrajectory }
);

export default GetSimulationCellByTrajectoryController;
