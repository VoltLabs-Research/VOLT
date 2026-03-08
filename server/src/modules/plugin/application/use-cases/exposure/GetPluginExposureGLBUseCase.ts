import { injectable, inject } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/SceneArtifact';
import {
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureGLBDTO';
import { createStreamResponse } from '@modules/plugin/application/helpers/create-download-response';

@injectable()
export class GetPluginExposureGLBUseCase implements IUseCase<
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async execute(
        input: GetPluginExposureGLBInputDTO
    ): Promise<Result<GetPluginExposureGLBOutputDTO, ApplicationError>> {
        const analysis = await this.analysisRepository.findById(String(input.analysisId));

        if (!analysis) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            ));
        }

        if (String(analysis.props.team) !== String(input.teamId)) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            ));
        }

        const artifactFilter: Partial<SceneArtifactProps> = {
            trajectory: String(input.trajectoryId),
            analysis: String(input.analysisId),
            sourceType: 'plugin-exposure',
            timestep: Number(input.timestep),
            params: {
                exposureId: String(input.exposureId)
            }
        };

        const artifact = await this.sceneArtifactRepository.findOne(artifactFilter);

        if (!artifact) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
            ));
        }

        const objectName = artifact.props.objectName;
        const bucket = artifact.props.storageBucket || SYS_BUCKETS.MODELS;
        const [stat, stream] = await Promise.all([
            this.storageService.getStat(bucket, objectName),
            this.storageService.getStream(bucket, objectName)
        ]);

        return Result.ok(createStreamResponse({
            stream,
            contentType: 'model/gltf-binary',
            contentLength: stat.size,
            disposition: 'inline',
            filename: objectName,
            cacheControl: 'public, max-age=31536000, immutable'
        }));
    }
}
