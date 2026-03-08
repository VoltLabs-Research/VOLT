import { createController } from '@shared/infrastructure/http/controllers/createController';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';

const GetSimulationCellByIdController = createController(
    SIMULATION_CELL_TOKENS.GetSimulationCellByIdUseCase,
    { validationSchema: simulationCellValidationSchemas.getById }
);

export default GetSimulationCellByIdController;
