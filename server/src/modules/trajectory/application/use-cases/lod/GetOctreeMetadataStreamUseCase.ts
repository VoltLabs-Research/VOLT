import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetOctreeMetadataStreamInputDTO } from '@modules/trajectory/application/dtos/line-style';
import type { ILineStyleService } from '@modules/trajectory/domain/port/line-style/ILineStyleService';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@Singleton()
export class GetOctreeMetadataStreamUseCase implements IUseCase<GetOctreeMetadataStreamInputDTO, StreamableOutput> {
    constructor(
        @inject(TRAJECTORY_TOKENS.LineStyleService)
        private readonly lineStyleService: ILineStyleService
    ) { }

    async execute(input: GetOctreeMetadataStreamInputDTO): Promise<StreamableOutput> {
        const response = await this.lineStyleService.getOctreeMetadataStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId
        );

        return response satisfies StreamableOutput;
    }
};
