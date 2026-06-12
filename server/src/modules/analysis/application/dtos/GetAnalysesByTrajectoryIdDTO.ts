/**
 * Re-export shim — canonical DTOs now live in the neutral contracts layer
 * (detachable-modules migration).
 */
export type {
    GetAnalysesByTrajectoryIdInputDTO,
    GetAnalysesByTrajectoryItemDTO,
    GetAnalysesByTrajectoryIdOutputDTO
} from '@shared/contracts/dtos/GetAnalysesByTrajectoryIdDTO';
