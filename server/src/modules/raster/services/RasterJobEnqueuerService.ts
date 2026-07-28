import { ErrorCodes } from '@core/constants/error-codes';
import type { IDaemonAnalysisCompletionService, ITeamClusterSelectionService } from '@shared/contracts/ports';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';

import Trajectory from '@modules/trajectory/models/Trajectory';

interface RasterizeTrajectoryCommandPayload extends Record<string, unknown> {
    trajectoryId: string;
    teamId: string;
    storageClusterId?: string;
}

export interface RasterJobEnqueueResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
    jobs?: Array<{
        jobId: string;
        teamId: string;
        queueType: string;
        name?: string;
        analysisId?: string;
        trajectoryId?: string;
        trajectoryName?: string;
        timestep?: number;
    }>;
}

export class RasterJobEnqueuerService {
    constructor(
        private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        private readonly teamClusterDaemonClient: ITeamClusterDaemonClient,
        private readonly daemonAnalysisCompletionService: IDaemonAnalysisCompletionService
    ) {}

    async triggerRasterization(
        trajectoryId: string,
        teamId: string
    ): Promise<RasterJobEnqueueResult>{
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if(!trajectory || trajectory.team !== teamId){
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const storageClusterId = trajectory.storageClusterId;
        if(!storageClusterId){
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
                        trajectoryName: trajectory.name
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
