import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetRasterMetadataOutputDTO } from '../dtos/RasterDTOs';
import { IRasterService } from '../../domain/ports/IRasterService';

import { RASTER_TOKENS } from '../../infrastructure/di/RasterTokens';

@injectable()
export class GetRasterMetadataUseCase implements IUseCase<string, GetRasterMetadataOutputDTO> {
    constructor(
        @inject(RASTER_TOKENS.RasterService) private rasterService: IRasterService
    ) { }

    async execute(trajectoryId: string): Promise<Result<GetRasterMetadataOutputDTO>> {
        const metadata = await this.rasterService.getRasterMetadata(trajectoryId);

        return Result.ok({ metadata });
    }
}
