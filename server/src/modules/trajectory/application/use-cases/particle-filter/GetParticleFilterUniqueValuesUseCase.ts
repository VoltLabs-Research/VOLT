import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetParticleFilterUniqueValuesInputDTO, GetParticleFilterUniqueValuesOutputDTO } from '@modules/trajectory/application/dtos/generated-models';

@injectable()
export class GetParticleFilterUniqueValuesUseCase implements IUseCase<GetParticleFilterUniqueValuesInputDTO, GetParticleFilterUniqueValuesOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) {}

    async execute(input: GetParticleFilterUniqueValuesInputDTO): Promise<Result<GetParticleFilterUniqueValuesOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep, property } = input;
        const maxValues = input.maxValues !== undefined ? Number(input.maxValues) : undefined;
        const hasMissingRequired = [trajectoryId, timestep, property].some((value) => !value?.trim());

        if (hasMissingRequired || (maxValues !== undefined && !Number.isFinite(maxValues))) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                'Missing required particle-filter parameters'
            ));
        }

        const values = await this.particleFilterService.getUniqueValues(
            trajectoryId,
            timestep,
            property,
            maxValues,
            input.analysisId,
            input.exposureId
        );

        return Result.ok({ values });
    }
}
