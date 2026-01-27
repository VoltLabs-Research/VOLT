import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { IAnalysisRepository } from '../../domain/repositories/IAnalysisRepository';
import type { AnalysisConfig, RetryFailedFramesResponse } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/types/api';

export class AnalysisRepository extends BaseRepository implements IAnalysisRepository {
    constructor() {
        super('/analysis', { useRBAC: true });
    }

    async getByTeamId(params?: { page?: number; limit?: number; q?: string }): Promise<PaginatedResponse<AnalysisConfig>> {
        return this.get<PaginatedResponse<AnalysisConfig>>('/', { query: params });
    }

    async getByTrajectoryId(trajectoryId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<AnalysisConfig>> {
        return this.get<PaginatedResponse<AnalysisConfig>>(`/trajectory/${trajectoryId}`, { query: params });
    }

    async deleteConfig(id: string): Promise<void> {
        await this.delete(`/${id}`);
    }

    async retryFailedFrames(id: string): Promise<RetryFailedFramesResponse> {
        return this.post<RetryFailedFramesResponse>(`/${id}/retry-failed-frames`);
    }
}

export const analysisRepository = new AnalysisRepository();
