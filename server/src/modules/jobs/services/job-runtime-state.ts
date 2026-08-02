import redisClient from '@shared/infrastructure/redis/redisClient';
import type { TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import {
    analysisFailedKey,
    analysisRemainingKey,
    analysisTerminalReceiptSetKey,
    canvasWorkspaceIndexKey,
    canvasWorkspaceKey,
    glbFailedKey,
    glbRemainingKey,
    glbTerminalReceiptSetKey,
    jobStatusKey,
    jobTombstoneKey,
    jupyterTrajectoryLockKey,
    projectedAnalysisJobsKey,
    projectedTeamJobsKey,
    projectedTeamJobsRevisionKey
} from '@modules/jobs/services/JobRedisKeys';

/* Redis-side mutations that drop projected job snapshots and purge the runtime
   state left behind by deleted trajectories and analyses. */

const TOMBSTONE_TTL_SECONDS = 600;

export interface DroppedProjectedJobs {
    deletedJobs: number;
    deletedAnalyses: number;
}

const wasKeyDeleted = (result: [Error | null, unknown] | undefined): boolean => {
    if (!result || result[0]) {
        return false;
    }

    return typeof result[1] === 'number' && result[1] > 0;
};

export const dropProjectedJobs = async (
    teamId: string,
    jobs: TeamJobSummary[],
    preserveJobTombstones = true
): Promise<DroppedProjectedJobs> => {
    if (jobs.length === 0) {
        return {
            deletedJobs: 0,
            deletedAnalyses: 0
        };
    }

    const pipeline = redisClient.pipeline();
    const statusDeletionIndexes: number[] = [];
    let queued = 0;

    for (const job of jobs) {
        statusDeletionIndexes.push(queued);
        pipeline.del(jobStatusKey(job.jobId));
        pipeline.srem(projectedTeamJobsKey(teamId), job.jobId);
        queued += 2;

        if (preserveJobTombstones) {
            pipeline.set(jobTombstoneKey(job.jobId), '1', 'EX', TOMBSTONE_TTL_SECONDS);
        } else {
            pipeline.del(jobTombstoneKey(job.jobId));
        }
        queued += 1;

        if (job.analysisId) {
            pipeline.srem(projectedAnalysisJobsKey(job.analysisId), job.jobId);
            queued += 1;
        }
    }

    pipeline.incr(projectedTeamJobsRevisionKey(teamId));

    const results = await pipeline.exec();
    if (!results) {
        return {
            deletedJobs: 0,
            deletedAnalyses: 0
        };
    }

    let deletedJobs = 0;
    const deletedAnalyses = new Set<string>();

    jobs.forEach((job, position) => {
        if (!wasKeyDeleted(results[statusDeletionIndexes[position]])) {
            return;
        }

        deletedJobs += 1;
        if (job.analysisId) {
            deletedAnalyses.add(job.analysisId);
        }
    });

    return {
        deletedJobs,
        deletedAnalyses: deletedAnalyses.size
    };
};

export const purgeTrajectoryRuntimeState = async (teamId: string, trajectoryId: string): Promise<void> => {
    const [glbTerminalKeys, canvasOwnerIds] = await Promise.all([
        redisClient.smembers(glbTerminalReceiptSetKey(trajectoryId)),
        redisClient.smembers(canvasWorkspaceIndexKey(trajectoryId))
    ]);
    const pipeline = redisClient.pipeline();

    pipeline.del(glbRemainingKey(trajectoryId));
    pipeline.del(glbFailedKey(trajectoryId));
    pipeline.del(glbTerminalReceiptSetKey(trajectoryId));
    pipeline.del(jupyterTrajectoryLockKey(teamId, trajectoryId));
    pipeline.del(canvasWorkspaceIndexKey(trajectoryId));

    for (const terminalKey of glbTerminalKeys) {
        pipeline.del(terminalKey);
    }

    for (const ownerId of canvasOwnerIds) {
        pipeline.del(canvasWorkspaceKey(trajectoryId, ownerId));
    }

    await pipeline.exec();
};

export const purgeAnalysisRuntimeState = async (analysisId: string): Promise<void> => {
    const terminalKeys = await redisClient.smembers(analysisTerminalReceiptSetKey(analysisId));
    const pipeline = redisClient.pipeline();

    pipeline.del(analysisRemainingKey(analysisId));
    pipeline.del(analysisFailedKey(analysisId));
    pipeline.del(analysisTerminalReceiptSetKey(analysisId));

    for (const terminalKey of terminalKeys) {
        pipeline.del(terminalKey);
    }

    await pipeline.exec();
};
