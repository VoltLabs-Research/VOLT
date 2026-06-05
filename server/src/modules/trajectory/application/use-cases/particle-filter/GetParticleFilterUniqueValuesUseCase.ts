import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetParticleFilterUniqueValuesInputDTO, GetParticleFilterUniqueValuesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import type { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetParticleFilterUniqueValuesUseCase extends ValidatedServiceUseCase<
    GetParticleFilterUniqueValuesInputDTO,
    GetParticleFilterUniqueValuesOutputDTO,
    IParticleFilterService
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        @inject(TRAJECTORY_TOKENS.ParticleFilterService) particleFilterService: IParticleFilterService
    ) {
        super(
            particleFilterService,
            () => null,
            async (service, input) => {
                const values = await service.getUniqueValues(
                    input.trajectoryId,
                    input.timestep,
                    input.property,
                    input.maxValues,
                    input.analysisId,
                    input.exposureId
                );

                return { values };
            }
        );
    }
};
