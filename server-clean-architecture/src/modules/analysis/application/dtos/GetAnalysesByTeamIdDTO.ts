import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface GetAnalysesByTeamIdInputDTO{
    teamId: string;
}

export interface GetAnalysesByTeamIdOutputDTO extends PaginatedResult<AnalysisProps>{}