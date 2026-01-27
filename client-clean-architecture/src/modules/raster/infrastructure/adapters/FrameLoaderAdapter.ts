import type { IFrameLoader } from '../../application/use-cases/PreloadFramesUseCase';
import type { IRasterRepository } from '../../domain/repositories/IRasterRepository';

export class FrameLoaderAdapter implements IFrameLoader {
    constructor(private readonly rasterRepository: IRasterRepository) {}

    loadFrame(
        trajectoryId: string,
        timestep: number,
        analysisId: string,
        model: string
    ): Promise<any> {
        return this.rasterRepository.getFrameData(trajectoryId, timestep, analysisId, model);
    }
}
