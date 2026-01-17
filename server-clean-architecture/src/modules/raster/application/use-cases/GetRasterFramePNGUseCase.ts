import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetRasterFramePNGInputDTO } from '../dtos/RasterDTOs';
import { IRasterService } from '../../domain/ports/IRasterService';

import { RASTER_TOKENS } from '../../infrastructure/di/RasterTokens';

@injectable()
export class GetRasterFramePNGUseCase implements IUseCase<GetRasterFramePNGInputDTO, Buffer> {
    constructor(
        @inject(RASTER_TOKENS.RasterService) private rasterService: IRasterService
    ) { }

    async execute(input: GetRasterFramePNGInputDTO): Promise<Result<Buffer>> {
        const pngBuffer = await this.rasterService.getRasterFramePNG(
            input.trajectoryId,
            input.timestep
        );

        return Result.ok(pngBuffer);
    }
}
