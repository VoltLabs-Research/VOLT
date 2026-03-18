import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { IParticleFilterService, ParticleFilterCombinator } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

@injectable()
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
            {
                combinator: input.combinator || ParticleFilterCombinator.And,
                conditions: input.conditions && input.conditions.length > 0
                    ? input.conditions
                    : [{
                        property: input.property || '',
                        operator: input.operator || '==',
                        value: input.value ?? 0,
                        ...(input.exposureId ? { exposureId: input.exposureId } : {})
                    }]
            },
            input.analysisId
        );

        return Result.ok(result);
    }
};
