import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import { getKeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import type {
    RetryTeamJobsResult,
    TeamClusterFailureDetail
} from '@shared/contracts/ports/ITeamJobMaintenanceService';
import type { TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import logger from '@shared/infrastructure/logger';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import {
    getErrorMessage,
    groupByCluster,
    isDaemonJob
} from '@modules/jobs/services/team-job-maintenance-helpers';
import {
    analysisTerminalReceiptKey,
    analysisTerminalReceiptSetKey,
    glbTerminalReceiptKey,
    glbTerminalReceiptSetKey
} from '@modules/jobs/services/JobRuntimeKeys';

/* Retries daemon-backed team jobs, recovering GLB conversion jobs the daemon no
   longer tracks by re-enqueuing them from their persisted frames. */

const GLB_QUEUE_TYPE = 'trajectory_glb_conversion';

/**
 * Forgets that this job ever reported a terminal status.
 *
 * A retry has to clear the receipt as well as the status: the receipt is what
 * makes daemon reports idempotent, so leaving it behind would make the retried
 * run's own completion look like a duplicate and get dropped.
 */
const clearRetryReceipts = async (job: TeamJobSummary): Promise<void> => {
    await getKeyValueStore().transaction(async (store) => {
        if (job.queueType === 'analysis_processing' && job.analysisId) {
            const receiptKey = analysisTerminalReceiptKey(job.analysisId, job.jobId);
            await store.delete([receiptKey]);
            await store.setRemove(analysisTerminalReceiptSetKey(job.analysisId), [receiptKey]);
        }

        if (job.queueType === GLB_QUEUE_TYPE && job.trajectoryId) {
            const receiptKey = glbTerminalReceiptKey(job.trajectoryId, job.jobId);
            await store.delete([receiptKey]);
            await store.setRemove(glbTerminalReceiptSetKey(job.trajectoryId), [receiptKey]);
        }
    });
};

const markJobsRetrying = async (jobs: TeamJobSummary[]): Promise<void> => {
    await Promise.all(jobs.map(async (job) => {
        await clearRetryReceipts(job);
        await eventBus.emit('job.status.changed', {
            ...job,
            status: JobStatus.Retrying,
            source: 'projected',
            backingSource: 'daemon',
            message: undefined,
            error: undefined
        });
    }));
};

const requeueGlbPreprocessing = async (
    teamId: string,
    trajectoryId: string,
    timesteps: number[]
): Promise<string[]> => {
    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
    if(!trajectory){
        logger.warn(`[TeamJobMaintenanceService] requeue skipped — trajectory not found trajectoryId=${trajectoryId}`);
        return [];
    }

    const storageClusterId = trajectory.storageClusterId;
    if(!storageClusterId){
        logger.warn(`[TeamJobMaintenanceService] requeue skipped — no storageClusterId trajectoryId=${trajectoryId}`);
        return [];
    }

    const requestedTimesteps = new Set(timesteps);
    const persistedFrames = await TrajectoryFrame.find({
        where: { trajectoryId },
        select: { timestep: true }
    });
    const frames = persistedFrames.filter((frame) => requestedTimesteps.has(frame.timestep));

    if (frames.length === 0) {
        logger.warn(`[TeamJobMaintenanceService] requeue skipped — no persisted frames trajectoryId=${trajectoryId}`);
        return [];
    }

    await teamClusterDaemonClient.command(
        storageClusterId,
        ChannelCommands.TrajectoryEnqueuePreprocessing,
        {
            trajectoryId,
            teamId,
            storageClusterId,
            frames: frames.map((frame) => ({
                timestep: frame.timestep,
                objectKey: buildTrajectoryDumpObjectName(trajectoryId, frame.timestep),
                ownerClusterId: storageClusterId
            }))
        },
        { timeoutClass: 'long-running-control-plane' }
    );

    return frames.map((frame) => `trajectory-glb:${trajectoryId}:${frame.timestep}`);
};

const requeueMissingGlbJobs = async (teamId: string, jobs: TeamJobSummary[]): Promise<Set<string>> => {
    const groupedByTrajectory = new Map<string, TeamJobSummary[]>();

    for (const job of jobs) {
        if (job.queueType !== GLB_QUEUE_TYPE || !job.trajectoryId || job.timestep === undefined) {
            continue;
        }

        const bucket = groupedByTrajectory.get(job.trajectoryId) ?? [];
        bucket.push(job);
        groupedByTrajectory.set(job.trajectoryId, bucket);
    }

    const recoveredJobIds = new Set<string>();

    for (const [trajectoryId, trajectoryJobs] of groupedByTrajectory) {
        const timesteps = trajectoryJobs
            .map((job) => job.timestep)
            .filter((timestep): timestep is number => timestep !== undefined);

        try {
            await markJobsRetrying(trajectoryJobs);

            for (const jobId of await requeueGlbPreprocessing(teamId, trajectoryId, timesteps)) {
                recoveredJobIds.add(jobId);
            }
        } catch (error) {
            logger.warn(error, `[TeamJobMaintenanceService] Failed to requeue persisted GLB jobs for trajectory ${trajectoryId}`);
        }
    }

    return recoveredJobIds;
};

export const retryTeamJobs = async (teamId: string, targetJobs: TeamJobSummary[]): Promise<RetryTeamJobsResult> => {
    const clusterFailures: TeamClusterFailureDetail[] = [];
    let retriedFrames = 0;
    let affectedClusters = 0;

    for (const [teamClusterId, clusterJobs] of groupByCluster(targetJobs.filter(isDaemonJob))) {
        try {
            const response = await teamClusterDaemonClient.command<{ affectedJobIds: string[] }>(
                teamClusterId,
                ChannelCommands.JobsRetry,
                { jobIds: clusterJobs.map((job) => job.jobId) }
            );
            const affectedSet = new Set(response.affectedJobIds);
            const retriedJobs = clusterJobs.filter((job) => affectedSet.has(job.jobId));
            const missingJobs = clusterJobs.filter((job) => !affectedSet.has(job.jobId));
            const recoveredJobIds = await requeueMissingGlbJobs(teamId, missingJobs);
            const confirmedCount = retriedJobs.length
                + missingJobs.filter((job) => recoveredJobIds.has(job.jobId)).length;

            if (confirmedCount !== clusterJobs.length) {
                clusterFailures.push({
                    teamClusterId,
                    requestedJobs: clusterJobs.length,
                    affectedJobs: confirmedCount,
                    reason: 'partial-confirmation',
                    message: `Cluster confirmed or recovered ${confirmedCount} of ${clusterJobs.length} requested job retries`
                });
            }

            if (confirmedCount > 0) {
                affectedClusters += 1;
            }
            retriedFrames += confirmedCount;

            await markJobsRetrying(retriedJobs);
        } catch (error) {
            clusterFailures.push({
                teamClusterId,
                requestedJobs: clusterJobs.length,
                affectedJobs: 0,
                reason: 'command-failed',
                message: getErrorMessage(error)
            });
            logger.warn(error, `[TeamJobMaintenanceService] Failed to retry jobs on cluster ${teamClusterId}`);
        }
    }

    return {
        retriedFrames,
        affectedClusters,
        clusterFailures
    };
};
