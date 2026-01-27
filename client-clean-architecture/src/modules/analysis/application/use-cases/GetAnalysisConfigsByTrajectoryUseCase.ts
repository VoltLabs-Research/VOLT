import type { IAnalysisRepository } from '../../domain/repositories/IAnalysisRepository';
import type { PaginatedResponse } from '@/shared/types/api';
import type { AnalysisConfig } from '../../domain/entities';

export class GetAnalysisConfigsByTrajectoryUseCase {
    constructor(private readonly analysisRepository: IAnalysisRepository) {}

    async execute(
        trajectoryId: string,
        params?: { page?: number; limit?: number }
    ): Promise<PaginatedResponse<AnalysisConfig>> {
        return this.analysisRepository.getByTrajectoryId(trajectoryId, params);
    }
}
