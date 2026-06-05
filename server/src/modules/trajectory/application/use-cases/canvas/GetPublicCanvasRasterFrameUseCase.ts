import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { IRasterStorageService } from '@modules/raster/domain/port/IRasterStorageService';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import type {
    GetPublicCanvasRasterFrameInputDTO,
    GetPublicCanvasRasterFrameOutputDTO
} from '@modules/trajectory/application/dtos/canvas/GetPublicCanvasRasterFrameDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { resolveSceneArtifactStorageCluster } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-storage-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

@Singleton()
export class GetPublicCanvasRasterFrameUseCase implements IUseCase<
    GetPublicCanvasRasterFrameInputDTO,
    GetPublicCanvasRasterFrameOutputDTO,
    ApplicationError
> {
    constructor(

        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(RASTER_TOKENS.RasterStorageService)
        private readonly rasterStorage: IRasterStorageService,


        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,


        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository
    ) {}

    async execute(
        input: GetPublicCanvasRasterFrameInputDTO
    ): Promise<Result<GetPublicCanvasRasterFrameOutputDTO, ApplicationError>> {
        try {
            if ((input.analysisId && !input.model) || (!input.analysisId && input.model)) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Analysis raster frame requests require both analysisId and model'
                ));
            }

            const trajectory = await this.trajectoryReadAccessService.assertReadable(
                input.trajectoryId,
                input.userId
            );

            let rasterFrame;
            if (input.analysisId && input.model) {
                const analysis = await this.analysisRepository.findById(input.analysisId);
                if (!analysis || analysis.props.trajectory !== input.trajectoryId) {
                    return Result.fail(ApplicationError.notFound(
                        'Analysis::NotFound',
                        'Analysis not found'
                    ));
                }

                const sceneArtifactClusterId = await resolveSceneArtifactStorageCluster({
                    trajectoryId: input.trajectoryId,
                    analysisId: input.analysisId,
                    analysisRepository: this.analysisRepository,
                    trajectoryRepository: this.trajectoryRepository
                });
                if (!sceneArtifactClusterId) {
                    return Result.fail(ApplicationError.conflict(
                        'Analysis::StorageClusterRequired',
                        'Analysis storage cluster is required'
                    ));
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
                    return Result.fail(ApplicationError.conflict(
                        'Trajectory::StorageClusterRequired',
                        'Trajectory storage cluster is required'
                    ));
                }

                rasterFrame = await this.rasterStorage.getRasterFramePNG(
                    input.trajectoryId,
                    input.timestep,
                    storageClusterId
                );
            }

            return Result.ok(createDownloadStreamResponse({
                stream: rasterFrame.stream,
                contentType: rasterFrame.contentType,
                contentLength: rasterFrame.contentLength,
                cacheControl: rasterFrame.cacheControl,
                filename: rasterFrame.filename,
                disposition: 'inline'
            }));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster frame PNG',
                500
            ));
        }
    }
};
