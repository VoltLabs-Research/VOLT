import { ErrorCodes } from '@core/constants/error-codes';
import { RASTER_TOKENS } from '@modules/raster/di/RasterTokens';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import { CLUSTER_SERVICE_TOKENS } from '@shared/contracts/tokens/ClusterServiceTokens';
import type { IDaemonAnalysisCompletionService, ITeamClusterSelectionService, ITrajectoryRepository } from '@shared/contracts/ports';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type {
    IRasterJobEnqueuer,
    RasterJobEnqueueResult
} from '@modules/raster/ports/IRasterJobEnqueuer';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject } from 'tsyringe';

interface RasterizeTrajectoryCommandPayload extends Record<string, unknown> {
    trajectoryId: string;
    teamId: string;
    storageClusterId?: string;
}

@Singleton(RASTER_TOKENS.RasterJobEnqueuer)
export class RasterJobEnqueuerService implements IRasterJobEnqueuer {
    constructor(
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        @inject(CLUSTER_SERVICE_TOKENS.DaemonAnalysisCompletionService) private readonly daemonAnalysisCompletionService: IDaemonAnalysisCompletionService
    ) {}

    async triggerRasterization(
        trajectoryId: string,
        teamId: string
    ): Promise<RasterJobEnqueueResult> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);

        if (!trajectory || trajectory.props.team !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (!storageClusterId) {
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Rasterization requires a storage cluster associated with the trajectory',
                409
            );
        }

        const computeClusterId = await this.teamClusterSelectionService.resolveComputeClusterId(
            teamId,
            undefined,
            storageClusterId
        );

        const payload: RasterizeTrajectoryCommandPayload = {
            trajectoryId,
            teamId,
            storageClusterId
        };

        try {
            const response = await this.teamClusterDaemonClient.command<RasterJobEnqueueResult>(
                computeClusterId,
                ChannelCommands.TrajectoryRasterize,
                payload
            );

            if (response.jobs?.length) {
                await this.daemonAnalysisCompletionService.handleQueuedJobs(
                    response.jobs.map((job) => ({
                        ...job,
                        trajectoryName: trajectory.props.name
                    })),
                    'raster',
                    computeClusterId
                ).catch((projectionError) => {
                    logger.warn(projectionError, `Failed to project queued raster jobs for trajectory ${trajectoryId}`);
                });
            }

            return response;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            logger.warn(error, `Failed to queue rasterization jobs for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to queue rasterization jobs',
                500
            );
        }
    }
}
