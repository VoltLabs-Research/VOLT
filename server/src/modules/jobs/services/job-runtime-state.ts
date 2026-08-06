import { getKeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';
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
} from '@modules/jobs/services/JobRuntimeKeys';

/* Drops projected job snapshots and purges the runtime state left behind by
   deleted trajectories and analyses. */

const TOMBSTONE_TTL_MS = 600_000;

export interface DroppedProjectedJobs {
    deletedJobs: number;
    deletedAnalyses: number;
}

/**
 * Forgets the given jobs' projected state.
 *
 * The count reflects the jobs this call actually removed, not the jobs it was
 * asked about: a concurrent drop of the same team must not have its work counted
 * twice. That is read straight from which status keys the delete claimed, which
 * is why they are removed in one statement rather than one per job.
 */
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

    return getKeyValueStore().transaction(async (store) => {
        const claimed = new Set(await store.deleteReturningPresent(jobs.map((job) => jobStatusKey(job.jobId))));

        await store.setRemove(projectedTeamJobsKey(teamId), jobs.map((job) => job.jobId));

        const tombstoneKeys = jobs.map((job) => jobTombstoneKey(job.jobId));
        if (preserveJobTombstones) {
            /*
             * A tombstone tells a late daemon report that this job was removed on
             * purpose, so it is not re-projected. It outlives the drop by design.
             */
            for (const tombstoneKey of tombstoneKeys) {
                await store.set(tombstoneKey, '1', { ttlMs: TOMBSTONE_TTL_MS });
            }
        } else {
            await store.delete(tombstoneKeys);
        }

        const deletedAnalyses = new Set<string>();
        for (const job of jobs) {
            if (!job.analysisId) continue;

            await store.setRemove(projectedAnalysisJobsKey(job.analysisId), [job.jobId]);
            if (claimed.has(jobStatusKey(job.jobId))) {
                deletedAnalyses.add(job.analysisId);
            }
        }

        /* Bumped so readers holding a stale projection know to refetch. */
        await store.adjust(projectedTeamJobsRevisionKey(teamId), 1);

        return {
            deletedJobs: claimed.size,
            deletedAnalyses: deletedAnalyses.size
        };
    });
};

export const purgeTrajectoryRuntimeState = async (teamId: string, trajectoryId: string): Promise<void> => {
    await getKeyValueStore().transaction(async (store) => {
        /* The indexes name the per-item keys, so they are read before being dropped. */
        const [terminalKeys, canvasOwnerIds] = await Promise.all([
            store.setMembers(glbTerminalReceiptSetKey(trajectoryId)),
            store.setMembers(canvasWorkspaceIndexKey(trajectoryId))
        ]);

        await store.delete([
            glbRemainingKey(trajectoryId),
            glbFailedKey(trajectoryId),
            jupyterTrajectoryLockKey(teamId, trajectoryId),
            ...terminalKeys,
            ...canvasOwnerIds.map((ownerId) => canvasWorkspaceKey(trajectoryId, ownerId))
        ]);

        await store.deleteSets([
            glbTerminalReceiptSetKey(trajectoryId),
            canvasWorkspaceIndexKey(trajectoryId)
        ]);
    });
};

export const purgeAnalysisRuntimeState = async (analysisId: string): Promise<void> => {
    await getKeyValueStore().transaction(async (store) => {
        const terminalKeys = await store.setMembers(analysisTerminalReceiptSetKey(analysisId));

        await store.delete([
            analysisRemainingKey(analysisId),
            analysisFailedKey(analysisId),
            ...terminalKeys
        ]);

        await store.deleteSets([analysisTerminalReceiptSetKey(analysisId)]);
    });
};
