import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { PreviewParticleFilterInputDTO, PreviewParticleFilterOutputDTO } from '@modules/trajectory/dtos/particle-filter';
import { buildParticleFilterRequest } from '@modules/trajectory/utilities/build-particle-filter-request';
import type { IParticleFilterService } from '@modules/trajectory/ports/particle-filter/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class PreviewParticleFilterUseCase implements IUseCase<PreviewParticleFilterInputDTO, PreviewParticleFilterOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: PreviewParticleFilterInputDTO): Promise<PreviewParticleFilterOutputDTO> {
        return this.particleFilterService.preview(
            input.trajectoryId,
            input.timestep,
            buildParticleFilterRequest(input),
            input.analysisId
        );
    }
};
