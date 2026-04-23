import { ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { buildParticleFilterRequest } from '@modules/trajectory/application/utilities/build-particle-filter-request';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ParticleFilterService from '@modules/trajectory/infrastructure/services/particle-filter/ParticleFilterService';

@Singleton()
export class ApplyParticleFilterActionUseCase implements IUseCase<ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO, ApplicationError> {
    constructor(
        
        private readonly particleFilterService: ParticleFilterService
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
