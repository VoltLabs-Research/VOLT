import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetParticleFilterUniqueValuesInputDTO, GetParticleFilterUniqueValuesOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { runTrajectoryService } from '@modules/trajectory/application/use-cases/shared/run-trajectory-service';
import type { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import type { IUseCase } from '@shared/application/IUseCase';
import type { Result } from '@shared/domain/port/Result';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetParticleFilterUniqueValuesUseCase
    implements IUseCase<GetParticleFilterUniqueValuesInputDTO, GetParticleFilterUniqueValuesOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService) private readonly particleFilterService: IParticleFilterService
    ) {}

    execute(input: GetParticleFilterUniqueValuesInputDTO): Promise<Result<GetParticleFilterUniqueValuesOutputDTO, ApplicationError>> {
        return runTrajectoryService(this.particleFilterService, input, async (service, dto) => {
            const values = await service.getUniqueValues(
                dto.trajectoryId,
                dto.timestep,
                dto.property,
                dto.maxValues,
                dto.analysisId,
                dto.exposureId
            );

            return { values };
        });
    }
};
