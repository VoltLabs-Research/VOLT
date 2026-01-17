import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { TriggerRasterizationInputDTO, TriggerRasterizationOutputDTO } from '../dtos/RasterDTOs';
import { IRasterService } from '../../domain/ports/IRasterService';

import { RASTER_TOKENS } from '../../infrastructure/di/RasterTokens';

@injectable()
export class TriggerRasterizationUseCase implements IUseCase<TriggerRasterizationInputDTO, TriggerRasterizationOutputDTO> {
    constructor(
        @inject(RASTER_TOKENS.RasterService) private rasterService: IRasterService
    ) { }

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
