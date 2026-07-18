import type { AnalysisProps } from '@shared/contracts/types';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface GetAnalysesByTrajectoryIdInputDTO {
    teamId?: string;
    trajectoryId: string;
    page?: number;
    limit?: number;
}

export interface GetAnalysesByTrajectoryItemDTO extends Omit<AnalysisProps, 'plugin'> {
    _id: string;
    plugin: string;
    pluginDisplayName: string;
}

export interface GetAnalysesByTrajectoryIdOutputDTO extends PaginatedResult<GetAnalysesByTrajectoryItemDTO> {}
