import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
// The cross-consumed analysis list item view (+ its nested cluster/trajectory/
// user shapes) MOVED to the neutral contracts layer (detachable-modules
// migration). Canonical home: `@shared/contracts/dtos`. Re-exported here so
// existing in-module importers compile unchanged.
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
