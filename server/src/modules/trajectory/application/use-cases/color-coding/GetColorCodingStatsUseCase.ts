import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetColorCodingStatsInputDTO, GetColorCodingStatsOutputDTO } from '@modules/trajectory/application/dtos/generated-models';

@injectable()
export class GetColorCodingStatsUseCase implements IUseCase<GetColorCodingStatsInputDTO, GetColorCodingStatsOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(input: GetColorCodingStatsInputDTO): Promise<Result<GetColorCodingStatsOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep, property, type } = input;
        const hasMissingRequired = [trajectoryId, timestep, property, type].some((value) => !value?.trim());

        if (hasMissingRequired) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                'Missing required color-coding parameters'
            ));
        }

        const stats = await this.colorCodingService.getStats(
            trajectoryId,
            timestep,
            property,
            type,
            input.analysisId,
            input.exposureId
        );

        return Result.ok(stats);
    }
}
