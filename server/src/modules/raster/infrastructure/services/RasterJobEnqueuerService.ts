import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type {
    IRasterJobEnqueuer,
    RasterJobEnqueueResult,
    RasterTriggerConfig
} from '@modules/raster/domain/port/IRasterJobEnqueuer';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface RasterizeTrajectoryCommandPayload extends Record<string, unknown> {
    trajectoryId: string;
    teamId: string;
    trajectoryName?: string;
    storageClusterId?: string;
    config?: RasterTriggerConfig;
};

@injectable()
export class RasterJobEnqueuerService implements IRasterJobEnqueuer {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TeamClusterSelectionService)
        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
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

        if (trajectory.props.name) {
            payload.trajectoryName = trajectory.props.name;
        }

        if (config) {
            payload.config = config;
        }

        try {
            const response = await this.teamClusterDaemonClient.command<RasterJobEnqueueResult>(
                computeClusterId,
                TEAM_CLUSTER_DAEMON_COMMAND.trajectory.rasterize,
                payload
            );

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
};
