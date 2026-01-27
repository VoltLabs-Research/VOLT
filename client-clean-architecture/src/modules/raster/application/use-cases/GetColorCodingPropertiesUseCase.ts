import type { IRasterRepository } from '../../domain/repositories/IRasterRepository';
import type { ColorCodingProperties } from '../../domain/entities';

export class GetColorCodingPropertiesUseCase {
    constructor(private readonly rasterRepository: IRasterRepository) {}

    async execute(
        trajectoryId: string,
        analysisId: string | undefined,
        timestep: number
    ): Promise<ColorCodingProperties> {
        return this.rasterRepository.getColorCodingProperties(trajectoryId, analysisId, timestep);
    }
}
