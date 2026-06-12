import type { AnalysisProps } from '@shared/contracts/types';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

/**
 * Neutral DTOs for the get-analyses-by-trajectory query (detachable-modules
 * migration). Consumed cross-module (trajectory public-canvas analyses list).
 * Owner module re-exports these.
 */
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
