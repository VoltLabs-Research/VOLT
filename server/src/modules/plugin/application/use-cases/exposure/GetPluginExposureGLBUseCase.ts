import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { inject } from 'tsyringe';
import type { ISceneArtifactRepository, IAnalysisRepository, ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import {
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureGLBDTO';
import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetPluginExposureGLBUseCase } from '@shared/contracts/ports/IGetPluginExposureGLBUseCase';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

import { ErrorCodes } from '@core/constants/error-codes';
import { resolveSceneArtifactStorageClusterId } from '@shared/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@shared/contracts/types';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';

import type { SceneArtifactProps } from '@shared/contracts/types';
import { getClusterGlbStream } from '@shared/application/utilities/glb-stream-resolution';
import type { IUseCase } from '@shared/application/IUseCase';
import type { Readable } from 'node:stream';

@Singleton()
@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginExposureGLBUseCase)
export class GetPluginExposureGLBUseCase implements IUseCase<
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO,
    ApplicationError
>, IGetPluginExposureGLBUseCase {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(COMPUTE_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: ITeamClusterObjectGatewayClient
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
        const teamClusterId = resolveSceneArtifactStorageClusterId(artifact.props);
        if (!teamClusterId) {
            return Result.fail(ApplicationError.conflict(
                'SceneArtifact::StorageClusterRequired',
                'Scene artifact storage cluster is required'
            ));
        }
        const requestContext = { acceptEncoding: input.acceptEncoding };

        const buildDownloadResponse = (
            stream: Readable,
            size: number | undefined,
            filename: string,
            contentEncoding: string
        ) => {
            const extraHeaders: Record<string, string> = {};

            if (contentEncoding !== 'identity') {
                extraHeaders['X-Volt-Resource-Encoding'] = contentEncoding;
            }

            return createDownloadStreamResponse({
                stream,
                contentType: 'model/gltf-binary',
                contentLength: size,
                disposition: 'inline',
                filename,
                cacheControl: 'public, max-age=31536000, immutable',
                extraHeaders
            });
        };

        try {
            const response = await getClusterGlbStream(this.objectGatewayClient, teamClusterId, objectName, requestContext);

            return Result.ok(buildDownloadResponse(
                response.stream,
                response.size,
                response.objectName,
                response.contentEncoding
            ));
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
}
