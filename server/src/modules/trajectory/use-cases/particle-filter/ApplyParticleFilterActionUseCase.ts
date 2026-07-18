import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO } from '@modules/trajectory/dtos/particle-filter';
import { buildParticleFilterRequest } from '@modules/trajectory/utilities/build-particle-filter-request';
import type { IParticleFilterService } from '@modules/trajectory/ports/particle-filter/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class ApplyParticleFilterActionUseCase implements IUseCase<ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: ApplyParticleFilterActionInputDTO): Promise<ApplyParticleFilterActionOutputDTO> {
        return this.particleFilterService.applyAction(
            input.trajectoryId,
            input.timestep,
            input.action,
            buildParticleFilterRequest(input),
            input.analysisId
        );
    }
};
