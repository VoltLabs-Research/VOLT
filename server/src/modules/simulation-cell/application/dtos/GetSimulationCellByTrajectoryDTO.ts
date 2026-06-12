/**
 * Re-export shim (detachable-modules migration). The canonical, neutral DTO now
 * lives at `@shared/contracts/dtos/GetSimulationCellByTrajectoryDTO`. This owner
 * file re-exports both names so existing
 * `@modules/simulation-cell/application/dtos/GetSimulationCellByTrajectoryDTO`
 * importers compile unchanged.
 */
export type {
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
} from '@shared/contracts/dtos/GetSimulationCellByTrajectoryDTO';
