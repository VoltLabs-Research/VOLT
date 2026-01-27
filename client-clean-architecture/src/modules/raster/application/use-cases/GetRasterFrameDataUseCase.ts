import type { IRasterRepository } from '../../domain/repositories/IRasterRepository';
import type { RasterFrameData } from '../../domain/entities';

export class GetRasterFrameDataUseCase {
    constructor(private readonly rasterRepository: IRasterRepository) {}

    async execute(
        trajectoryId: string,
        timestep: number,
        analysisId: string,
        model: string
    ): Promise<RasterFrameData> {
        return this.rasterRepository.getFrameData(trajectoryId, timestep, analysisId, model);
    }
}
