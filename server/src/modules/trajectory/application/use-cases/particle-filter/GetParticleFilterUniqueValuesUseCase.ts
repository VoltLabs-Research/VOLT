import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetParticleFilterUniqueValuesInputDTO, GetParticleFilterUniqueValuesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable, inject } from 'tsyringe';

@injectable()
export class GetParticleFilterUniqueValuesUseCase extends ValidatedServiceUseCase<
    GetParticleFilterUniqueValuesInputDTO,
    GetParticleFilterUniqueValuesOutputDTO,
    IParticleFilterService
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
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
