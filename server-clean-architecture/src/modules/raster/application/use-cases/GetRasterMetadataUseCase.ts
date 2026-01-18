import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetRasterMetadataOutputDTO } from '@modules/raster/application/dtos/RasterDTOs';
import { IRasterService } from '@modules/raster/domain/ports/IRasterService';

import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';

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
