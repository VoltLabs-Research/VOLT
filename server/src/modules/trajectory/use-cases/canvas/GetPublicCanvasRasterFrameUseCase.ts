import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/ports/trajectory/ITrajectoryRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { IRasterStorageService } from '@shared/contracts/ports';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import type {
    GetPublicCanvasRasterFrameInputDTO,
    GetPublicCanvasRasterFrameOutputDTO
} from '@modules/trajectory/dtos/canvas/GetPublicCanvasRasterFrameDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import { resolveSceneArtifactStorageCluster } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-storage-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

@Singleton()
export class GetPublicCanvasRasterFrameUseCase implements IUseCase<
    GetPublicCanvasRasterFrameInputDTO,
    GetPublicCanvasRasterFrameOutputDTO
> {
    constructor(

        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(RASTER_CONTRACT_TOKENS.RasterStorageService)
        private readonly rasterStorage: IRasterStorageService,


        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,


        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository
    ) {}

    async execute(
        input: GetPublicCanvasRasterFrameInputDTO
    ): Promise<GetPublicCanvasRasterFrameOutputDTO> {
        try {
            if ((input.analysisId && !input.model) || (!input.analysisId && input.model)) {
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Analysis raster frame requests require both analysisId and model'
                );
            }

            const trajectory = await this.trajectoryReadAccessService.assertReadable(
                input.trajectoryId,
                input.userId
            );

            let rasterFrame;
            if (input.analysisId && input.model) {
                const analysis = await this.analysisRepository.findById(input.analysisId);
                if (!analysis || analysis.props.trajectory !== input.trajectoryId) {
                    throw ApplicationError.notFound(
                        'Analysis::NotFound',
                        'Analysis not found'
                    );
                }

                const sceneArtifactClusterId = await resolveSceneArtifactStorageCluster({
                    trajectoryId: input.trajectoryId,
                    analysisId: input.analysisId,
                    analysisRepository: this.analysisRepository,
                    trajectoryRepository: this.trajectoryRepository
                });
                if (!sceneArtifactClusterId) {
                    throw ApplicationError.conflict(
                        'Analysis::StorageClusterRequired',
                        'Analysis storage cluster is required'
                    );
                }

                rasterFrame = await this.rasterStorage.getAnalysisRasterFramePNG(
                    input.trajectoryId,
                    input.analysisId,
                    input.timestep,
                    input.model,
                    sceneArtifactClusterId
                );
            } else {
                const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
                if (!storageClusterId) {
                    throw ApplicationError.conflict(
                        'Trajectory::StorageClusterRequired',
                        'Trajectory storage cluster is required'
                    );
                }

                rasterFrame = await this.rasterStorage.getRasterFramePNG(
                    input.trajectoryId,
                    input.timestep,
                    storageClusterId
                );
            }

            return createDownloadStreamResponse({
                stream: rasterFrame.stream,
                contentType: rasterFrame.contentType,
                contentLength: rasterFrame.contentLength,
                cacheControl: rasterFrame.cacheControl,
                filename: rasterFrame.filename,
                disposition: 'inline'
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster frame PNG',
                500
            );
        }
    }
};
