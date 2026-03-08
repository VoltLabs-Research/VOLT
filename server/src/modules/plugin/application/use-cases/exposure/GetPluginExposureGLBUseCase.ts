import {
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureGLBDTO';
import { createStreamResponse } from '@modules/plugin/application/helpers/plugin/create-download-response';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

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
            sourceType: SceneArtifactSourceType.PluginExposure,
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
};
