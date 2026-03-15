import { ErrorCodes } from '@core/constants/error-codes';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IRasterJobEnqueuer, RasterJobEnqueueResult } from '@modules/raster/domain/port/IRasterJobEnqueuer';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface SerializableConfig {
    [key: string]: unknown;
};

const isSerializableConfig = (value: unknown): value is SerializableConfig => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

@injectable()
export class RasterJobEnqueuerService implements IRasterJobEnqueuer {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async triggerRasterization(trajectoryId: string, teamId: string, config?: unknown): Promise<RasterJobEnqueueResult> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);

        if (!trajectory || trajectory.props.team !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        if (!trajectory.props.teamCluster) {
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Rasterization requires a team cluster associated with the trajectory',
                409
            );
        }

        const payload: SerializableConfig = {
            trajectoryId,
            teamId,
            trajectoryName: trajectory.props.name
        };

        if (isSerializableConfig(config)) {
            payload.config = config;
        }

        try {
            const response = await this.teamClusterDaemonClient.command<RasterJobEnqueueResult>(
                trajectory.props.teamCluster,
                'trajectory.rasterize',
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
