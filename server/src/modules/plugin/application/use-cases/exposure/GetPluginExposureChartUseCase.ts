import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { ISceneArtifactRepository, ITrajectoryRepository, ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import { inject } from 'tsyringe';
import {
    GetPluginExposureChartInputDTO,
    GetPluginExposureChartOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureChartDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveSceneArtifactStorageClusterId } from '@shared/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@shared/contracts/types';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { Singleton } from '@shared/infrastructure/di/decorators';

const isChartArtifact = (metadata: Record<string, unknown> | undefined, objectName: string): boolean => {
    return objectName.endsWith('.png')
        && (
            metadata?.exporter === 'ChartExporter'
            || metadata?.exportType === 'chart-png'
        );
};

@Singleton()
export class GetPluginExposureChartUseCase implements IUseCase<GetPluginExposureChartInputDTO, GetPluginExposureChartOutputDTO> {
    constructor(
        @inject(COMPUTE_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository,
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: ITeamClusterObjectGatewayClient
    ) {}

    async execute(
        input: GetPluginExposureChartInputDTO
    ): Promise<GetPluginExposureChartOutputDTO> {
        const artifact = await this.sceneArtifactRepository.findById(String(input.artifactId));
        if (!artifact || artifact.props.sourceType !== SceneArtifactSourceType.PluginExposure) {
            throw ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            );
        }

        const trajectory = await this.trajectoryRepository.findById(String(artifact.props.trajectory));
        if (!trajectory || String(trajectory.props.team) !== String(input.teamId)) {
            throw ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            );
        }

        const metadata = artifact.props.metadata as Record<string, unknown> | undefined;
        if (!isChartArtifact(metadata, artifact.props.objectName)) {
            throw ApplicationError.badRequest(
                'PluginExposureChart::UnsupportedArtifact',
                'Scene artifact is not a plugin chart'
            );
        }

        const teamClusterId = resolveSceneArtifactStorageClusterId(artifact.props);
        if (!teamClusterId) {
            throw ApplicationError.conflict(
                'SceneArtifact::StorageClusterRequired',
                'Scene artifact storage cluster is required'
            );
        }

        try {
            const response = await this.objectGatewayClient.getStream(
                teamClusterId,
                artifact.props.storageBucket,
                artifact.props.objectName
            );

            return createDownloadStreamResponse({
                stream: response.stream,
                contentType: 'image/png',
                contentLength: response.contentLength,
                disposition: 'inline',
                filename: artifact.props.displayName || 'plugin-chart.png',
                cacheControl: 'public, max-age=31536000, immutable'
            });
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.notFound(
                    ErrorCodes.FILE_NOT_FOUND,
                    ErrorCodes.FILE_NOT_FOUND
                );
            }

            throw ApplicationError.internalServerError(
                'Failed to read plugin chart from team cluster daemon'
            );
        }
    }
}
