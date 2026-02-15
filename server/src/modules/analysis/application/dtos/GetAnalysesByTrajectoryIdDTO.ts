import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export interface GetAnalysesByTrajectoryIdInputDTO {
    trajectoryId: string;
    page?: number;
    limit?: number;
}

export interface GetAnalysesByTrajectoryItemDTO extends Omit<AnalysisProps, 'plugin'> {
    _id: string;
    plugin: string;
    pluginDisplayName?: string;
}

export interface GetAnalysesByTrajectoryIdOutputDTO extends PaginatedResult<GetAnalysesByTrajectoryItemDTO> {}
