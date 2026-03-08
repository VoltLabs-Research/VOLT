import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { GetFilteredModelStreamInputDTO, GetFilteredModelStreamOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@injectable()
export class GetFilteredModelStreamUseCase implements IUseCase<GetFilteredModelStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: GetFilteredModelStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
        const stream = await this.particleFilterService.getModelStream(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.operator,
            input.value,
            input.action,
            input.analysisId,
            input.exposureId
        );

        return Result.ok({ stream } satisfies GetFilteredModelStreamOutputDTO & StreamableOutput);
    }
}
