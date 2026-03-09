import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface GetAnalysesByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
};

export interface GetAnalysesByTeamIdItemDTO extends Omit<AnalysisProps, 'plugin'> {
    _id: string;
    plugin: string;
    pluginDisplayName?: string;
};

export interface GetAnalysesByTeamIdOutputDTO extends PaginatedResult<GetAnalysesByTeamIdItemDTO> {};
