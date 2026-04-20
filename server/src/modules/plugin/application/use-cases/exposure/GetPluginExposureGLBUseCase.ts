import {
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureGLBDTO';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { resolveSceneArtifactStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { getClusterGlbStream, getLocalGlbStream } from '@modules/trajectory/utilities/storage/glb-stream-resolution';

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
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
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
        const teamClusterId = resolveSceneArtifactStorageClusterId(artifact.props);

        if (teamClusterId) {
            try {
                const response = await getClusterGlbStream(this.objectGatewayClient, teamClusterId, objectName);

                return Result.ok(createDownloadStreamResponse({
                    stream: response.stream,
                    contentType: 'model/gltf-binary',
                    contentLength: response.size,
                    disposition: 'inline',
                    filename: response.objectName,
                    cacheControl: 'public, max-age=31536000, immutable'
                }));
            } catch (error) {
                if (error instanceof ApplicationError && error.statusCode === 404) {
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

        const response = await getLocalGlbStream(this.storageService, objectName);

        return Result.ok(createDownloadStreamResponse({
            stream: response.stream,
            contentType: 'model/gltf-binary',
            contentLength: response.size,
            disposition: 'inline',
            filename: response.objectName,
            cacheControl: 'public, max-age=31536000, immutable'
        }));
    }
};
