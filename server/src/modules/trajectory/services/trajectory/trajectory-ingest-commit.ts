import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryUploadSession from '@modules/trajectory/models/TrajectoryUploadSession';
import { TrajectoryUploadSessionStatus } from '@modules/trajectory/contracts/trajectory-upload-session';

import daemonAnalysisCompletionService from '@modules/cluster/services/daemon/DaemonAnalysisCompletionService';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { insertSimulationCells } from '@modules/simulation-cell/services/SimulationCellService';

import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import logger from '@shared/infrastructure/logger';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';

import type { SimulationCellProps } from '@shared/contracts/types/SimulationCell';
import type { TrajectoryFrame } from '@shared/contracts/types/Trajectory';
import type { TrajectoryUploadSessionRequest } from '@modules/trajectory/services/TrajectoryServiceTypes';

const GLB_QUEUE_TYPE = 'trajectory_glb_conversion';
const GLB_JOB_NAME = 'Preprocess trajectory frame';

export interface TrajectoryIngestResult {
    frames: Array<{
        timestep: number;
        natoms: number;
        simulationCell: Pick<SimulationCellProps, 'boundingBox' | 'geometry'> | null;
    }>;
    stats: {
        totalFiles: number;
        totalSize: number;
    };
}

export const isNoValidFramesError = (error: unknown): boolean => (
    /no valid trajectory frames/i.test(error instanceof Error ? error.message : '')
);

/**
 * The daemon could not read an object the upload had already staged, which is an
 * infrastructure failure rather than a bad upload. Kept distinct from
 * `isNoValidFramesError` so the two never share a message: telling a user their file
 * has no readable frames when the truth is that we lost track of it sends them off to
 * re-export a trajectory that was fine.
 */
export const isUnreadableStagedObjectError = (error: unknown): boolean => (
    /unreadable staged object/i.test(error instanceof Error ? error.message : '')
);

export const requestTrajectoryIngest = (
    session: TrajectoryUploadSession,
    teamId: string
): Promise<TrajectoryIngestResult> => teamClusterDaemonClient.command<TrajectoryIngestResult>(
    session.ownerClusterId,
    ChannelCommands.TrajectoryIngest,
    {
        trajectoryId: session.resourceId,
        teamId,
        stagedObjects: session.files.map((file) => ({
            objectKey: file.finalObjectKey,
            originalName: file.originalName,
            size: file.size,
            parts: file.parts.map((part) => ({
                objectKey: part.objectKey,
                partNumber: part.partNumber,
                size: part.size
            }))
        }))
    },
    { timeoutMs: 0 }
);

export const persistIngestedFrames = async (
    trajectoryId: string,
    teamId: string,
    frames: TrajectoryIngestResult['frames']
): Promise<TrajectoryFrame[]> => {
    const cellItems = frames
        .filter((frame) => frame.simulationCell)
        .map((frame) => ({
            ...frame.simulationCell!,
            team: teamId,
            trajectory: trajectoryId,
            timestep: frame.timestep
        }));

    const cells = await insertSimulationCells(cellItems);

    let cellIndex = 0;
    return frames.map((frame) => ({
        timestep: frame.timestep,
        natoms: frame.natoms,
        simulationCell: frame.simulationCell ? cells[cellIndex++]._id : undefined
    }));
};

export const projectQueuedGlbJobs = async (
    trajectoryId: string,
    trajectoryName: string,
    teamId: string,
    ownerClusterId: string,
    frames: TrajectoryFrame[]
): Promise<void> => {
    await daemonAnalysisCompletionService.initializeGlbSession(trajectoryId, frames.length, teamId);
    await daemonAnalysisCompletionService.handleQueuedJobs(
        frames.map((frame) => ({
            jobId: `trajectory-glb:${trajectoryId}:${frame.timestep}`,
            teamId,
            queueType: GLB_QUEUE_TYPE,
            name: GLB_JOB_NAME,
            trajectoryId,
            trajectoryName,
            timestep: frame.timestep
        })),
        'glb',
        ownerClusterId
    ).catch((projectionError) => {
        logger.warn(projectionError, `[TrajectoryUploadSessionService] Failed to project queued GLB jobs for ${trajectoryId}`);
    });
};

export const discardFailedCommit = async (
    sessionId: string,
    trajectoryId: string,
    input: TrajectoryUploadSessionRequest
): Promise<void> => {
    await TrajectoryUploadSession.update(
        { id: sessionId },
        { status: TrajectoryUploadSessionStatus.Failed }
    ).catch(() => {});

    const trajectory = await Trajectory.findOneBy({ id: trajectoryId }).catch(() => null);
    await Trajectory.delete({ id: trajectoryId }).catch((deleteError) => {
        logger.warn(deleteError, `[TrajectoryUploadSessionService] Failed to delete orphaned trajectory ${trajectoryId}`);
    });

    await eventBus.emit('trajectory.deleted', {
        trajectoryId,
        teamId: input.teamId,
        storageClusterId: trajectory?.storageClusterId,
        userId: input.userId,
        trajectoryName: trajectory?.name ?? 'Trajectory',
        analysisIds: [],
        analysisComputeClusterIds: []
    }).catch(() => {});
};
