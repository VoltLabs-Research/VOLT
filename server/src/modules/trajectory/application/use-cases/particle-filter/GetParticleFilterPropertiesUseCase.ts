import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable, inject } from 'tsyringe';

@injectable()
export class GetParticleFilterPropertiesUseCase extends ValidatedServiceUseCase<
    GetParticleFilterPropertiesInputDTO,
    GetParticleFilterPropertiesOutputDTO,
    IParticleFilterService
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) {
        super(
            particleFilterService,
            () => null,
            (service, input) => service.getProperties(input.trajectoryId, input.timestep, input.analysisId)
        );
    }
};
