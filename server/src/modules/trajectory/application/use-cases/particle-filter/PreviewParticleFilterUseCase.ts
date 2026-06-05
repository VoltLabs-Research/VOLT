import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { PreviewParticleFilterInputDTO, PreviewParticleFilterOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { buildParticleFilterRequest } from '@modules/trajectory/application/utilities/build-particle-filter-request';
import type { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class PreviewParticleFilterUseCase implements IUseCase<PreviewParticleFilterInputDTO, PreviewParticleFilterOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: PreviewParticleFilterInputDTO): Promise<Result<PreviewParticleFilterOutputDTO, ApplicationError>> {
        const result = await this.particleFilterService.preview(
            input.trajectoryId,
            input.timestep,
            buildParticleFilterRequest(input),
            input.analysisId
        );

        return Result.ok(result);
    }
};
