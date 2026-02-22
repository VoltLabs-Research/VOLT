import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface GetAnalysesByTeamIdInputDTO{
    teamId: string;
    page?: number;
    limit?: number;
}

export interface GetAnalysesByTeamIdItemDTO extends Omit<AnalysisProps, 'plugin'> {
    _id: string;
    plugin: string;
    pluginDisplayName?: string;
}

export interface GetAnalysesByTeamIdOutputDTO extends PaginatedResult<GetAnalysesByTeamIdItemDTO>{}
