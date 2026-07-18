/**
 * Canonical, neutral use-case PORT for "get simulation cell by trajectory".
 * Extracted from
 * `@modules/simulation-cell/application/use-cases/GetSimulationCellByTrajectoryUseCase`
 * during the detachable-modules migration so cross-module consumers (currently
 * `@modules/trajectory`'s canvas use case) can depend on the contract and inject
 * via `SIMULATION_CELL_CONTRACT_TOKENS.GetSimulationCellByTrajectoryUseCase`
 * instead of importing the owner's concrete class.
 *
 * Built only on neutral `@shared/*` symbols (`IUseCase`, `ApplicationError`) and
 * the neutral DTO contract. No `@modules/*` imports.
 */
import type { IUseCase } from '@shared/application/IUseCase';
import type {
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
} from '@shared/contracts/dtos/GetSimulationCellByTrajectoryDTO';

export interface IGetSimulationCellByTrajectoryUseCase extends IUseCase<
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
> {}
