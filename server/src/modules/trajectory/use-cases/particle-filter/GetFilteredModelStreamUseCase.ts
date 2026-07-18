import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { GetFilteredModelStreamInputDTO, GetFilteredModelStreamOutputDTO } from '@modules/trajectory/dtos/particle-filter';
import { buildParticleFilterRequest } from '@modules/trajectory/utilities/build-particle-filter-request';
import type { IParticleFilterService } from '@modules/trajectory/ports/particle-filter/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@Singleton()
export class GetFilteredModelStreamUseCase implements IUseCase<GetFilteredModelStreamInputDTO, StreamableOutput> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: GetFilteredModelStreamInputDTO): Promise<StreamableOutput> {
        const response = await this.particleFilterService.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            buildParticleFilterRequest(input),
            input.action,
            input.analysisId
        );

        return response satisfies GetFilteredModelStreamOutputDTO & StreamableOutput;
    }
};
