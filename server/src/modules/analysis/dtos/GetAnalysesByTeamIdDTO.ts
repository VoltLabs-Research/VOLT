import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
export type {
    GetAnalysesByTeamIdItemDTO,
    AnalysisListTeamCluster,
    AnalysisListTrajectory,
    AnalysisListUser
} from '@shared/contracts/dtos';

export interface GetAnalysesByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export interface GetAnalysesByTeamIdOutputDTO extends PaginatedResult<import('@shared/contracts/dtos').GetAnalysesByTeamIdItemDTO> {}
