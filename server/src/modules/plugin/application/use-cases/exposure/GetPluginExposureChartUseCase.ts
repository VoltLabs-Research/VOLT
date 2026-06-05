import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import { inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import {
    GetPluginExposureChartInputDTO,
    GetPluginExposureChartOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureChartDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveSceneArtifactStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
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
export class GetPluginExposureChartUseCase implements IUseCase<
    GetPluginExposureChartInputDTO,
    GetPluginExposureChartOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async execute(
        input: GetPluginExposureChartInputDTO
    ): Promise<Result<GetPluginExposureChartOutputDTO, ApplicationError>> {
        const artifact = await this.sceneArtifactRepository.findById(String(input.artifactId));
        if (!artifact || artifact.props.sourceType !== SceneArtifactSourceType.PluginExposure) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            ));
        }

        const trajectory = await this.trajectoryRepository.findById(String(artifact.props.trajectory));
        if (!trajectory || String(trajectory.props.team) !== String(input.teamId)) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            ));
        }

        const metadata = artifact.props.metadata as Record<string, unknown> | undefined;
        if (!isChartArtifact(metadata, artifact.props.objectName)) {
            return Result.fail(ApplicationError.badRequest(
                'PluginExposureChart::UnsupportedArtifact',
                'Scene artifact is not a plugin chart'
            ));
        }

        const teamClusterId = resolveSceneArtifactStorageClusterId(artifact.props);
        if (!teamClusterId) {
            return Result.fail(ApplicationError.conflict(
                'SceneArtifact::StorageClusterRequired',
                'Scene artifact storage cluster is required'
            ));
        }

        try {
            const response = await this.objectGatewayClient.getStream(
                teamClusterId,
                artifact.props.storageBucket,
                artifact.props.objectName
            );

            return Result.ok(createDownloadStreamResponse({
                stream: response.stream,
                contentType: 'image/png',
                contentLength: response.contentLength,
                disposition: 'inline',
                filename: artifact.props.displayName || 'plugin-chart.png',
                cacheControl: 'public, max-age=31536000, immutable'
            }));
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.FILE_NOT_FOUND,
                    ErrorCodes.FILE_NOT_FOUND
                ));
            }

            return Result.fail(ApplicationError.internalServerError(
                'Failed to read plugin chart from team cluster daemon'
            ));
        }
    }
}
