import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { runTrajectoryService } from '@modules/trajectory/application/use-cases/shared/run-trajectory-service';
import type { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetParticleFilterPropertiesUseCase
    implements IUseCase<GetParticleFilterPropertiesInputDTO, GetParticleFilterPropertiesOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService) private readonly particleFilterService: IParticleFilterService
    ) {}

    execute(input: GetParticleFilterPropertiesInputDTO): Promise<GetParticleFilterPropertiesOutputDTO> {
        return runTrajectoryService(this.particleFilterService, input, (service, dto) =>
            service.getProperties(dto.trajectoryId, dto.timestep, dto.analysisId));
    }
};
