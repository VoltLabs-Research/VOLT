import { container } from 'tsyringe';
import { SIMULATION_CELL_TOKENS } from './SimulationCellTokens';
import SimulationCellRepository from '../persistence/mongo/repositories/SimulationCellRepository';
import FindCellByIdUseCase from '../../application/use-cases/FindCellByIdUseCase';
import FindCellsByTeamIdUseCase from '../../application/use-cases/FindCellsByTeamIdUseCase';
import FindCellByIdController from '../http/controllers/FindCellByIdController';
import FindCellsByTeamIdController from '../http/controllers/FindCellsByTeamIdController';

export const registerSimulationCellDependencies = () => {
    container.register(SIMULATION_CELL_TOKENS.SimulationCellRepository, {
        useClass: SimulationCellRepository
    });

    // UseCases
    container.register(SIMULATION_CELL_TOKENS.FindCellByIdUseCase, {
        useClass: FindCellByIdUseCase
    });
    container.register(SIMULATION_CELL_TOKENS.FindCellsByTeamIdUseCase, {
        useClass: FindCellsByTeamIdUseCase
    });

    // Controllers
    container.register(SIMULATION_CELL_TOKENS.FindCellByIdController, {
        useClass: FindCellByIdController
    });
    container.register(SIMULATION_CELL_TOKENS.FindCellsByTeamIdController, {
        useClass: FindCellsByTeamIdController
    });
};
