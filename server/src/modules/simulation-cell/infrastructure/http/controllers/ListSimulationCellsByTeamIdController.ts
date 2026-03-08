import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';

const ListSimulationCellsByTeamIdController = createPaginatedController(
    SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdUseCase,
    { validationSchema: simulationCellValidationSchemas.listByTeamId }
);

export default ListSimulationCellsByTeamIdController;
