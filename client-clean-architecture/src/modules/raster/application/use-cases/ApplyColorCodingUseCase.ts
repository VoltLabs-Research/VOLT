import type { IRasterRepository } from '../../domain/repositories/IRasterRepository';
import type { ColorCodingPayload } from '../../domain/entities';

export class ApplyColorCodingUseCase {
    constructor(private readonly rasterRepository: IRasterRepository) {}

    async execute(
        trajectoryId: string,
        analysisId: string | undefined,
        timestep: number,
        payload: ColorCodingPayload
    ): Promise<void> {
        return this.rasterRepository.applyColorCoding(trajectoryId, analysisId, timestep, payload);
    }
}
