import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetFilteredModelStreamInputDTO, GetFilteredModelStreamOutputDTO } from '@modules/trajectory/application/dtos/generated-models';

@injectable()
export class GetFilteredModelStreamUseCase implements IUseCase<GetFilteredModelStreamInputDTO, GetFilteredModelStreamOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: GetFilteredModelStreamInputDTO): Promise<Result<GetFilteredModelStreamOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep, property, operator, action } = input;
        const value = input.value;
        const hasMissingRequired = [trajectoryId, timestep, property, operator].some((item) => !item?.trim());

        if (hasMissingRequired || (typeof value !== 'string' && typeof value !== 'number')) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                'Missing required particle-filter parameters'
            ));
        }

        const stream = await this.particleFilterService.getModelStream(
            trajectoryId,
            timestep,
            property,
            operator,
            value,
            action,
            input.analysisId,
            input.exposureId
        );

        return Result.ok(stream);
    }
}
