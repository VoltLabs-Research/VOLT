import { GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ParticleFilterService from '@modules/trajectory/infrastructure/services/particle-filter/ParticleFilterService';

@Singleton()
export class GetParticleFilterPropertiesUseCase extends ValidatedServiceUseCase<
    GetParticleFilterPropertiesInputDTO,
    GetParticleFilterPropertiesOutputDTO,
    IParticleFilterService
> {
    constructor(
        
        private readonly particleFilterService: ParticleFilterService
    ) {
        super(
            particleFilterService,
            () => null,
            (service, input) => service.getProperties(input.trajectoryId, input.timestep, input.analysisId)
        );
    }
};
