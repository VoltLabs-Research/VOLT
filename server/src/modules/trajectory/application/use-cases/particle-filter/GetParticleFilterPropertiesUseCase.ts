import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO } from '@modules/trajectory/application/dtos/generated-models';

@injectable()
export class GetParticleFilterPropertiesUseCase implements IUseCase<GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: GetParticleFilterPropertiesInputDTO): Promise<Result<GetParticleFilterPropertiesOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep } = input;
        const hasMissingRequired = [trajectoryId, timestep].some((value) => !value?.trim());

        if (hasMissingRequired) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                'Missing required particle-filter parameters'
            ));
        }

        const data = await this.particleFilterService.getProperties(trajectoryId, timestep, input.analysisId);
        return Result.ok(data);
    }
}
