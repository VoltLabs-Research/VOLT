import type { PaginatedResponse } from '@/shared/types/api';
import type { AnalysisConfig, RetryFailedFramesResponse } from '../entities';


export interface IAnalysisRepository {
    getByTeamId(params?: { page?: number; limit?: number; q?: string }): Promise<PaginatedResponse<AnalysisConfig>>;
    getByTrajectoryId(trajectoryId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<AnalysisConfig>>;
    deleteConfig(id: string): Promise<void>;
    retryFailedFrames(id: string): Promise<RetryFailedFramesResponse>;
}
