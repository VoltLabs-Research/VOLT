import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { PreviewParticleFilterInputDTO, PreviewParticleFilterOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

@injectable()
export class PreviewParticleFilterUseCase implements IUseCase<PreviewParticleFilterInputDTO, PreviewParticleFilterOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: PreviewParticleFilterInputDTO): Promise<Result<PreviewParticleFilterOutputDTO, ApplicationError>> {
        const result = await this.particleFilterService.preview(
            input.trajectoryId,
            input.timestep,
            {
                property: input.property,
                operator: input.operator,
                value: input.value
            },
            input.analysisId,
            input.exposureId
        );

        return Result.ok(result);
    }
};
