import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { ListSimulationCellsAITool } from '@modules/simulation-cell/application/ai-tools';
import { GetSimulationCellByIdUseCase, GetSimulationCellByTrajectoryUseCase, ListSimulationCellsByTeamIdUseCase } from '@modules/simulation-cell/application/use-cases';
import { SIMULATION_CELL_TOKENS } from './SimulationCellTokens';
import GetSimulationCellByIdController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByIdController';
import GetSimulationCellByTrajectoryController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByTrajectoryController';
import ListSimulationCellsByTeamIdController from '@modules/simulation-cell/infrastructure/http/controllers/ListSimulationCellsByTeamIdController';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerSimulationCellDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [SIMULATION_CELL_TOKENS.SimulationCellRepository, SimulationCellRepository],
            [SIMULATION_CELL_TOKENS.GetSimulationCellByIdUseCase, GetSimulationCellByIdUseCase],
            [SIMULATION_CELL_TOKENS.GetSimulationCellByTrajectoryUseCase, GetSimulationCellByTrajectoryUseCase],
            [SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdUseCase, ListSimulationCellsByTeamIdUseCase],
            [SIMULATION_CELL_TOKENS.GetSimulationCellByIdController, GetSimulationCellByIdController],
            [SIMULATION_CELL_TOKENS.GetSimulationCellByTrajectoryController, GetSimulationCellByTrajectoryController],
            [SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdController, ListSimulationCellsByTeamIdController]
        ]
    });

    const toolClasses = [ListSimulationCellsAITool];

    for (const ToolClass of toolClasses) {
        registerModuleDependencies({
            singletons: [[AI_TOKENS.AITool, ToolClass]]
        });
    }
};
