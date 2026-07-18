import SimulationCellService from '@modules/simulation-cell/services/SimulationCellService';
import type {
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
} from '@shared/contracts/dtos/GetSimulationCellByTrajectoryDTO';
import type { IGetSimulationCellByTrajectoryUseCase } from '@shared/contracts/ports/IGetSimulationCellByTrajectoryUseCase';
import { SIMULATION_CELL_CONTRACT_TOKENS } from '@shared/contracts/tokens/SimulationCellTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

/**
 * Thin cross-module adapter registered under the neutral
 * `SIMULATION_CELL_CONTRACT_TOKENS.GetSimulationCellByTrajectoryUseCase` token so
 * `@modules/trajectory`'s public-canvas use case can resolve "get simulation cell
 * by trajectory" without importing the owner module. The real logic was folded
 * into {@link SimulationCellService.getByTrajectory}; this adapter simply
 * `new`s the service and delegates, keeping a single implementation.
 */
@Singleton(SIMULATION_CELL_CONTRACT_TOKENS.GetSimulationCellByTrajectoryUseCase)
export default class GetSimulationCellByTrajectoryService implements IGetSimulationCellByTrajectoryUseCase {
    #service = new SimulationCellService();

    async execute(input: GetSimulationCellByTrajectoryInputDTO): Promise<GetSimulationCellByTrajectoryOutputDTO> {
        return this.#service.getByTrajectory(input);
    }
}
