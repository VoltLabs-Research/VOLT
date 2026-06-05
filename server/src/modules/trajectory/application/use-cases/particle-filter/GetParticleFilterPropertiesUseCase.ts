import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import type { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetParticleFilterPropertiesUseCase extends ValidatedServiceUseCase<
    GetParticleFilterPropertiesInputDTO,
    GetParticleFilterPropertiesOutputDTO,
    IParticleFilterService
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        @inject(TRAJECTORY_TOKENS.ParticleFilterService) particleFilterService: IParticleFilterService
    ) {
        super(
            particleFilterService,
            () => null,
            (service, input) => service.getProperties(input.trajectoryId, input.timestep, input.analysisId)
        );
    }
};
