import { ErrorCodes } from '@core/constants/error-codes';
import { createGetByIdController } from '@shared/infrastructure/http/controllers/createReadController';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';

const GetSimulationCellByIdController = createGetByIdController({
    repositoryToken: SIMULATION_CELL_TOKENS.SimulationCellRepository,
    paramKey: 'simulationCellId',
    notFoundCode: ErrorCodes.SIMULATION_CELL_NOT_FOUND,
    notFoundMessage: 'SimulationCell not found',
    populate: { path: 'trajectory', select: ['name'] },
    validationSchema: simulationCellValidationSchemas.getById
});

export default GetSimulationCellByIdController;
