import type { IAnalysisRepository } from '../../domain/repositories/IAnalysisRepository';
import type { PaginatedResponse } from '@/shared/types/api';
import type { AnalysisConfig } from '../../domain/entities';

export class GetAnalysisConfigsByTeamUseCase {
    constructor(private readonly analysisRepository: IAnalysisRepository) {}

    async execute(params?: { page?: number; limit?: number; q?: string }): Promise<PaginatedResponse<AnalysisConfig>> {
        return this.analysisRepository.getByTeamId(params);
    }
}
