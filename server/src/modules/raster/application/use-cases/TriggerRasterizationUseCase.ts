import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { TriggerRasterizationInputDTO, TriggerRasterizationOutputDTO } from '@modules/raster/application/dtos/RasterDTOs';
import { IRasterService } from '@modules/raster/domain/ports/IRasterService';

import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';

@injectable()
export class TriggerRasterizationUseCase implements IUseCase<TriggerRasterizationInputDTO, TriggerRasterizationOutputDTO> {
    constructor(
        @inject(RASTER_TOKENS.RasterService) private rasterService: IRasterService
    ){}

    async execute(input: TriggerRasterizationInputDTO): Promise<Result<TriggerRasterizationOutputDTO>> {
        const triggered = await this.rasterService.triggerRasterization(input.trajectoryId, input.config);

        return Result.ok({
            message: triggered
                ? 'Rasterization triggered successfully'
                : 'No rasterization needed (no GLB files found)',
            trajectoryId: input.trajectoryId,
            triggered
        });
    }
}
