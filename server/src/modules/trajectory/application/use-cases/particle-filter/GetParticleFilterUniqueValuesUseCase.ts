import { GetParticleFilterUniqueValuesInputDTO, GetParticleFilterUniqueValuesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ParticleFilterService from '@modules/trajectory/infrastructure/services/particle-filter/ParticleFilterService';

@Singleton()
export class GetParticleFilterUniqueValuesUseCase extends ValidatedServiceUseCase<
    GetParticleFilterUniqueValuesInputDTO,
    GetParticleFilterUniqueValuesOutputDTO,
    IParticleFilterService
> {
    constructor(
        
        particleFilterService: ParticleFilterService
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
