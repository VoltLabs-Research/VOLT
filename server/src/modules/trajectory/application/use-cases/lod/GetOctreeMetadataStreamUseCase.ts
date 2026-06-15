import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetOctreeMetadataStreamInputDTO } from '@modules/trajectory/application/dtos/line-style';
import type { ILineStyleService } from '@modules/trajectory/domain/port/line-style/ILineStyleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

// Streams an exposure's LOD octree-metadata sidecar (`<glb>.octree.json`) the
// daemon bakes next to the point-cloud GLB. The client LOD manager reads it to
// fetch only visible-region tiles. Reuses LineStyleService's exposure GLB
// resolution + sidecar streaming (same contract as the ranges sidecar).
@Singleton()
export class GetOctreeMetadataStreamUseCase implements IUseCase<GetOctreeMetadataStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.LineStyleService)
        private readonly lineStyleService: ILineStyleService
    ) { }

    async execute(input: GetOctreeMetadataStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
        const response = await this.lineStyleService.getOctreeMetadataStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId
        );

        return Result.ok(response satisfies StreamableOutput);
    }
};
