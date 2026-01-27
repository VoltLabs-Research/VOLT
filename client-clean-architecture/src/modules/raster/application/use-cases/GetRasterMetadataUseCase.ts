import type { IRasterRepository } from '../../domain/repositories/IRasterRepository';
import type { RasterMetadata } from '../../domain/entities';

export class GetRasterMetadataUseCase {
    constructor(private readonly rasterRepository: IRasterRepository) {}

    async execute(id: string): Promise<RasterMetadata> {
        return this.rasterRepository.getMetadata(id);
    }
}
