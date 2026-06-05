import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { buildParticleFilterRequest } from '@modules/trajectory/application/utilities/build-particle-filter-request';
import type { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class ApplyParticleFilterActionUseCase implements IUseCase<ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: ApplyParticleFilterActionInputDTO): Promise<Result<ApplyParticleFilterActionOutputDTO, ApplicationError>> {
        const result = await this.particleFilterService.applyAction(
            input.trajectoryId,
            input.timestep,
            input.action,
            buildParticleFilterRequest(input),
            input.analysisId
        );

        return Result.ok(result);
    }
};
