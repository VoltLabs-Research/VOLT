import { ErrorCodes } from '@core/constants/error-codes';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import type {
    IRasterJobEnqueuer,
    RasterJobEnqueueResult,
    RasterTriggerConfig
} from '@modules/raster/domain/port/IRasterJobEnqueuer';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import DaemonAnalysisCompletionService from '@modules/cluster/infrastructure/services/DaemonAnalysisCompletionService';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface RasterizeTrajectoryCommandPayload extends Record<string, unknown> {
    trajectoryId: string;
    teamId: string;
    storageClusterId?: string;
    config?: RasterTriggerConfig;
}

@Singleton(RASTER_TOKENS.RasterJobEnqueuer)
export class RasterJobEnqueuerService implements IRasterJobEnqueuer {
    constructor(
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly teamClusterSelectionService: TeamClusterSelectionService,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService
    ) {}

    async triggerRasterization(
        trajectoryId: string,
        teamId: string,
        config?: RasterTriggerConfig
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

        if (config) {
            payload.config = config;
        }

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
