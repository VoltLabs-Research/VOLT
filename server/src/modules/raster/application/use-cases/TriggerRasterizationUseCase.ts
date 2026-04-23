import { ErrorCodes } from '@core/constants/error-codes';
import type {
    TriggerRasterizationInputDTO,
    TriggerRasterizationOutputDTO
} from '@modules/raster/application/dtos/TriggerRasterizationDTO';
import { RasterJobEnqueuerService } from '@modules/raster/infrastructure/services/RasterJobEnqueuerService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class TriggerRasterizationUseCase implements IUseCase<TriggerRasterizationInputDTO, TriggerRasterizationOutputDTO, ApplicationError> {
    constructor(
        private readonly rasterJobEnqueuer: RasterJobEnqueuerService
    ) {}

    async execute(input: TriggerRasterizationInputDTO): Promise<Result<TriggerRasterizationOutputDTO, ApplicationError>> {
        try {
            const result = await this.rasterJobEnqueuer.triggerRasterization(input.trajectoryId, input.teamId, input.config);

            if (result.queuedJobs === 0 && result.skippedJobs === 0) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RASTER_NOT_FOUND,
                    'No rasterizable trajectory models were found in the team cluster storage'
                ));
            }

            if (result.queuedJobs === 0 && result.duplicateJobs > 0) {
                return Result.fail(new ApplicationError(
                    ErrorCodes.RASTER_ALREADY_QUEUED,
                    'Equivalent rasterization jobs are already queued or running for this trajectory',
                    409
                ));
            }

            return Result.ok({
                trajectoryId: input.trajectoryId,
                triggered: result.queuedJobs > 0,
                queuedJobs: result.queuedJobs,
                duplicateJobs: result.duplicateJobs,
                skippedJobs: result.skippedJobs,
                alreadyRasterizedJobs: result.alreadyRasterizedJobs
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
};
