import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { runTrajectoryService } from '@modules/trajectory/application/use-cases/shared/run-trajectory-service';
import type { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import type { IUseCase } from '@shared/application/IUseCase';
import type { Result } from '@shared/domain/port/Result';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetParticleFilterPropertiesUseCase
    implements IUseCase<GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService) private readonly particleFilterService: IParticleFilterService
    ) {}

    execute(input: GetParticleFilterPropertiesInputDTO): Promise<Result<GetParticleFilterPropertiesOutputDTO, ApplicationError>> {
        return runTrajectoryService(this.particleFilterService, input, (service, dto) =>
            service.getProperties(dto.trajectoryId, dto.timestep, dto.analysisId));
    }
};
