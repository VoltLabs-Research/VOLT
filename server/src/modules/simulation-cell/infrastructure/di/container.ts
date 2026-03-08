import { container } from 'tsyringe';
import { SIMULATION_CELL_TOKENS } from './SimulationCellTokens';
import type { AITool } from '@shared/application/ai/AITool';
import GetSimulationCellByIdUseCase from '@modules/simulation-cell/application/use-cases/GetSimulationCellByIdUseCase';
import GetSimulationCellByTrajectoryUseCase from '@modules/simulation-cell/application/use-cases/GetSimulationCellByTrajectoryUseCase';
import ListSimulationCellsByTeamIdUseCase from '@modules/simulation-cell/application/use-cases/ListSimulationCellsByTeamIdUseCase';
import GetSimulationCellByIdController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByIdController';
import GetSimulationCellByTrajectoryController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByTrajectoryController';
import ListSimulationCellsByTeamIdController from '@modules/simulation-cell/infrastructure/http/controllers/ListSimulationCellsByTeamIdController';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as simCellAiTools from '@modules/simulation-cell/application/ai-tools';

type AIToolConstructor = new (...args: any[]) => AITool;

export const registerSimulationCellDependencies = () => {
    container.registerSingleton(SIMULATION_CELL_TOKENS.SimulationCellRepository, SimulationCellRepository);
    container.registerSingleton(SIMULATION_CELL_TOKENS.GetSimulationCellByIdUseCase, GetSimulationCellByIdUseCase);
    container.registerSingleton(SIMULATION_CELL_TOKENS.GetSimulationCellByTrajectoryUseCase, GetSimulationCellByTrajectoryUseCase);
    container.registerSingleton(SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdUseCase, ListSimulationCellsByTeamIdUseCase);
    container.registerSingleton(SIMULATION_CELL_TOKENS.GetSimulationCellByIdController, GetSimulationCellByIdController);
    container.registerSingleton(SIMULATION_CELL_TOKENS.GetSimulationCellByTrajectoryController, GetSimulationCellByTrajectoryController);
    container.registerSingleton(SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdController, ListSimulationCellsByTeamIdController);

    const toolClasses = Object.values(simCellAiTools) as AIToolConstructor[];
    for (const ToolClass of toolClasses) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as never);
    }
};
