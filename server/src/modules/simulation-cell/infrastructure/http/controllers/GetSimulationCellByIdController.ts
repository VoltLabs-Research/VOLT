import { ErrorCodes } from '@core/constants/error-codes';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import { createGetByIdController } from '@shared/infrastructure/http/controllers/createReadController';

const GetSimulationCellByIdController = createGetByIdController({
    repositoryToken: SimulationCellRepository,
    paramKey: 'simulationCellId',
    notFoundCode: ErrorCodes.SIMULATION_CELL_NOT_FOUND,
    notFoundMessage: 'SimulationCell not found',
    populate: { path: 'trajectory', select: ['name'] },
    validationSchema: simulationCellValidationSchemas.getById
});

export default GetSimulationCellByIdController;
