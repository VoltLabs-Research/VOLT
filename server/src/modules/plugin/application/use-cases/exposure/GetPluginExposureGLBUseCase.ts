import {
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureGLBDTO';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TeamClusterDaemonStreamError } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

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
        private readonly sceneArtifactRepository: ISceneArtifactRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
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
        const teamClusterId = artifact.props.teamCluster ? String(artifact.props.teamCluster) : undefined;

        if (teamClusterId) {
            try {
                const response = await this.teamClusterDaemonClient.commandResponseStream(teamClusterId, 'object.get', {
                    bucket,
                    objectKey: objectName
                });
                const contentLengthHeader = response.headers['content-length'];
                const contentLength = typeof contentLengthHeader === 'string'
                    ? Number(contentLengthHeader)
                    : undefined;

                return Result.ok(createDownloadStreamResponse({
                    stream: response.stream,
                    contentType: response.headers['content-type'] || 'model/gltf-binary',
                    contentLength: typeof contentLength === 'number' && Number.isFinite(contentLength)
                        ? contentLength
                        : undefined,
                    disposition: 'inline',
                    filename: objectName,
                    cacheControl: 'public, max-age=31536000, immutable'
                }));
            } catch (error) {
                if (error instanceof TeamClusterDaemonStreamError && error.status === 404) {
                    return Result.fail(ApplicationError.notFound(
                        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
                    ));
                }

                return Result.fail(ApplicationError.internalServerError(
                    'Failed to read plugin exposure GLB from team cluster daemon'
                ));
            }
        }

        const [stat, stream] = await Promise.all([
            this.storageService.getStat(bucket, objectName),
            this.storageService.getStream(bucket, objectName)
        ]);

        return Result.ok(createDownloadStreamResponse({
            stream,
            contentType: 'model/gltf-binary',
            contentLength: stat.size,
            disposition: 'inline',
            filename: objectName,
            cacheControl: 'public, max-age=31536000, immutable'
        }));
    }
};
