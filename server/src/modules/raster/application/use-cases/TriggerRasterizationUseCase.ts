import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import type {
    TriggerRasterizationInputDTO,
    TriggerRasterizationOutputDTO
} from '@modules/raster/application/dtos/TriggerRasterizationDTO';
import type { IRasterJobEnqueuer } from '@modules/raster/domain/port/IRasterJobEnqueuer';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';

@injectable()
export class TriggerRasterizationUseCase implements IUseCase<TriggerRasterizationInputDTO, TriggerRasterizationOutputDTO, ApplicationError> {
    constructor(
        @inject(RASTER_TOKENS.RasterJobEnqueuer) private readonly rasterJobEnqueuer: IRasterJobEnqueuer
    ){}

    async execute(input: TriggerRasterizationInputDTO): Promise<Result<TriggerRasterizationOutputDTO, ApplicationError>> {
        try {
            const triggered = await this.rasterJobEnqueuer.triggerRasterization(input.trajectoryId, input.teamId, input.config);

            if (!triggered) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RASTER_NOT_FOUND,
                    'No GLB files found for rasterization'
                ));
            }

            return Result.ok({
                message: 'Rasterization triggered successfully',
                trajectoryId: input.trajectoryId,
                triggered: true
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to trigger rasterization',
                500
            ));
        }
    }
}
