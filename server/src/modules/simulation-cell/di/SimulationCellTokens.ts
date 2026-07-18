import { SIMULATION_CELL_CONTRACT_TOKENS } from '@shared/contracts/tokens/SimulationCellTokens';

export const SIMULATION_CELL_TOKENS = Object.freeze({
    SimulationCellService: Symbol.for('SimulationCellService'),
    SimulationCellRepository: SIMULATION_CELL_CONTRACT_TOKENS.SimulationCellRepository,
    GetSimulationCellByTrajectoryUseCase: SIMULATION_CELL_CONTRACT_TOKENS.GetSimulationCellByTrajectoryUseCase
});
