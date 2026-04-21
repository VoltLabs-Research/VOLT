import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { ListSimulationCellsAITool } from '@modules/simulation-cell/application/ai-tools';
import { GetSimulationCellByTrajectoryUseCase } from '@modules/simulation-cell/application/use-cases';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import GetSimulationCellByIdController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByIdController';
import GetSimulationCellByTrajectoryController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByTrajectoryController';
import ListSimulationCellsByTeamIdController from '@modules/simulation-cell/infrastructure/http/controllers/ListSimulationCellsByTeamIdController';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

const SIMULATION_CELL_AI_TOOLS = [ListSimulationCellsAITool];

export const simulationCellDIManifest: ModuleManifest = {
    name: 'simulation-cell',
    singletons: [
        [SIMULATION_CELL_TOKENS.SimulationCellRepository, SimulationCellRepository],
        [SIMULATION_CELL_TOKENS.GetSimulationCellByTrajectoryUseCase, GetSimulationCellByTrajectoryUseCase],
        [SIMULATION_CELL_TOKENS.GetSimulationCellByIdController, GetSimulationCellByIdController],
        [SIMULATION_CELL_TOKENS.GetSimulationCellByTrajectoryController, GetSimulationCellByTrajectoryController],
        [SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdController, ListSimulationCellsByTeamIdController],
        ...SIMULATION_CELL_AI_TOOLS.map((ToolClass) => [AI_TOKENS.AITool, ToolClass] as const)
    ]
};
