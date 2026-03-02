import { container } from 'tsyringe';
import { SIMULATION_CELL_TOKENS } from './SimulationCellTokens';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import FindCellByIdUseCase from '@modules/simulation-cell/application/use-cases/FindCellByIdUseCase';
import FindCellsByTeamIdUseCase from '@modules/simulation-cell/application/use-cases/FindCellsByTeamIdUseCase';
import FindCellByIdController from '@modules/simulation-cell/infrastructure/http/controllers/FindCellByIdController';
import FindCellsByTeamIdController from '@modules/simulation-cell/infrastructure/http/controllers/FindCellsByTeamIdController';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as simCellAiTools from '@modules/simulation-cell/application/ai-tools';

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

    // AI Tools
    for (const ToolClass of Object.values(simCellAiTools)) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as any);
    }
};
