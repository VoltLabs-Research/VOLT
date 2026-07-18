import { ErrorCodes } from '@core/constants/error-codes';
import type {
    TriggerRasterizationInputDTO,
    TriggerRasterizationOutputDTO
} from '@modules/raster/application/dtos/TriggerRasterizationDTO';
import type { IRasterJobEnqueuer } from '@modules/raster/domain/port/IRasterJobEnqueuer';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class TriggerRasterizationUseCase implements IUseCase<TriggerRasterizationInputDTO, TriggerRasterizationOutputDTO> {
    constructor(
        @inject(RASTER_TOKENS.RasterJobEnqueuer) private readonly rasterJobEnqueuer: IRasterJobEnqueuer
    ) {}

    async execute(input: TriggerRasterizationInputDTO): Promise<TriggerRasterizationOutputDTO> {
        try {
            const result = await this.rasterJobEnqueuer.triggerRasterization(input.trajectoryId, input.teamId);

            if (result.queuedJobs === 0 && result.skippedJobs === 0) {
                throw ApplicationError.notFound(
                    ErrorCodes.RASTER_NOT_FOUND,
                    'No rasterizable trajectory models were found in the team cluster storage'
                );
            }

            if (result.queuedJobs === 0 && result.duplicateJobs > 0) {
                throw new ApplicationError(
                    ErrorCodes.RASTER_ALREADY_QUEUED,
                    'Equivalent rasterization jobs are already queued or running for this trajectory',
                    409
                );
            }

            return {
                trajectoryId: input.trajectoryId,
                triggered: result.queuedJobs > 0,
                queuedJobs: result.queuedJobs,
                duplicateJobs: result.duplicateJobs,
                skippedJobs: result.skippedJobs,
                alreadyRasterizedJobs: result.alreadyRasterizedJobs
            };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to trigger rasterization',
                500
            );
        }
    }
}
