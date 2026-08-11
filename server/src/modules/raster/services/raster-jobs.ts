import { ErrorCodes } from '@core/constants/error-codes';
import daemonAnalysisCompletionService from '@modules/cluster/services/daemon/DaemonAnalysisCompletionService';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import logger from '@shared/infrastructure/logger';

import Trajectory from '@modules/trajectory/models/Trajectory';

interface RasterJobEnqueueResult {
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

export const enqueueRasterization = async (
    trajectoryId: string,
    teamId: string
): Promise<RasterJobEnqueueResult> => {
    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

    if(!trajectory || trajectory.team !== teamId){
        throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
    }

    if(!trajectory.storageClusterId){
        throw new ApplicationError(
            ErrorCodes.RASTER_FAILED,
            'Rasterization requires a storage cluster associated with the trajectory',
            409
        );
    }

    const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(
        teamId,
        undefined,
        trajectory.storageClusterId
    );

    const response = await teamClusterDaemonClient.command<RasterJobEnqueueResult>(
        computeClusterId,
        ChannelCommands.TrajectoryRasterize,
        {
            trajectoryId,
            teamId,
            storageClusterId: trajectory.storageClusterId
        }
    );

    if(response.jobs?.length){
        await daemonAnalysisCompletionService.handleQueuedJobs(
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
};
