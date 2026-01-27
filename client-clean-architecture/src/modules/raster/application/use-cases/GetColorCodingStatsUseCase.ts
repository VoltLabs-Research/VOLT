import type { IRasterRepository } from '../../domain/repositories/IRasterRepository';
import type { ColorCodingStats } from '../../domain/entities';

export class GetColorCodingStatsUseCase {
    constructor(private readonly rasterRepository: IRasterRepository) {}

    async execute(
        trajectoryId: string,
        analysisId: string | undefined,
        params?: { timestep?: number; property?: string; type?: string; exposureId?: string }
    ): Promise<ColorCodingStats> {
        return this.rasterRepository.getColorCodingStats(trajectoryId, analysisId, params);
    }
}
