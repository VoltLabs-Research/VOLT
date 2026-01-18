import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetRasterFramePNGInputDTO } from '@modules/raster/application/dtos/RasterDTOs';
import { IRasterService } from '@modules/raster/domain/ports/IRasterService';

import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';

@injectable()
export class GetRasterFramePNGUseCase implements IUseCase<GetRasterFramePNGInputDTO, Buffer> {
    constructor(
        @inject(RASTER_TOKENS.RasterService) private rasterService: IRasterService
    ){}

    async execute(input: GetRasterFramePNGInputDTO): Promise<Result<Buffer>> {
        const pngBuffer = await this.rasterService.getRasterFramePNG(
            input.trajectoryId,
            input.timestep
        );

        return Result.ok(pngBuffer);
    }
}
