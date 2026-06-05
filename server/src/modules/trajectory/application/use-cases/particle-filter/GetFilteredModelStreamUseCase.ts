import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetFilteredModelStreamInputDTO, GetFilteredModelStreamOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { buildParticleFilterRequest } from '@modules/trajectory/application/utilities/build-particle-filter-request';
import type { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@Singleton()
export class GetFilteredModelStreamUseCase implements IUseCase<GetFilteredModelStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: GetFilteredModelStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
        const response = await this.particleFilterService.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            buildParticleFilterRequest(input),
            input.action,
            input.analysisId
        );

        return Result.ok(response satisfies GetFilteredModelStreamOutputDTO & StreamableOutput);
    }
};
