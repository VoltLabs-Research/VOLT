import { getKeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';
import type { JobStatusChangedEventPayload } from '@shared/contracts/events/JobStatusChangedPayload';
import type { TeamJobSnapshot } from '@shared/contracts/types/TeamJobSnapshot';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import {
    jobStatusKey as buildJobStatusKey,
    jobTombstoneKey,
    projectedTeamJobsKey,
    projectedTeamJobsRevisionKey,
    projectedAnalysisJobsKey
} from '@modules/jobs/services/JobRuntimeKeys';

const STATUS_TTL_MS = 86_400_000;

const isTerminalStatus = (status: TeamJobSnapshot['status']): boolean => {
    return status === JobStatus.Completed || status === JobStatus.Failed;
};

/* A projected snapshot never regresses: terminal statuses stick, and a late Queued
   frame must not undo a Running or Retrying job. */
const holdsPreviousStatus = (
    previousStatus: TeamJobSnapshot['status'],
    incomingStatus: JobStatusChangedEventPayload['status']
): boolean => {
    if (isTerminalStatus(previousStatus)) {
        return true;
    }

    return incomingStatus === JobStatus.Queued
        && (previousStatus === JobStatus.Running || previousStatus === JobStatus.Retrying);
};

const resolveProjectedStatus = (
    previousStatus: TeamJobSnapshot['status'] | undefined,
    incomingStatus: JobStatusChangedEventPayload['status']
): {
    status: TeamJobSnapshot['status'];
    shouldAdvanceTimestamps: boolean;
} => {
    if (
        previousStatus
        && previousStatus !== incomingStatus
        && incomingStatus !== JobStatus.Retrying
        && holdsPreviousStatus(previousStatus, incomingStatus)
    ) {
        return {
            status: previousStatus,
            shouldAdvanceTimestamps: false
        };
    }

    return {
        status: incomingStatus,
        shouldAdvanceTimestamps: true
    };
};

/**
 * Maintains the projected view of a team's jobs that the UI reads.
 *
 * Merging a status change is read-decide-write, and the decision depends on the
 * value being written over, so the whole sequence is held under a lock named for
 * the job. The previous implementation could not lock and so compared-and-swapped
 * in a retry loop instead; holding the lock removes both the loop and the
 * possibility of exhausting it under contention.
 */
class TeamJobProjectionService {
    async upsertFromStatusChangedEvent(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot | null> {
        const {
            jobId,
            teamId,
            status,
            queueType,
            name,
            message,
            error,
            analysisId,
            trajectoryId,
            trajectoryName,
            timestep,
            teamClusterId,
            source,
            backingSource,
            cleanupScope,
            ...extra
        } = payload;
        const jobStatusKey = buildJobStatusKey(jobId);

        return getKeyValueStore().withLock(jobStatusKey, async (store) => {
            /* A tombstoned job was deleted deliberately, so a late report must not
               resurrect it into the projection. */
            if (await store.exists(jobTombstoneKey(jobId))) {
                return null;
            }

            const previousSnapshot = this.parseSnapshot(await store.get(jobStatusKey));
            const resolvedStatus = resolveProjectedStatus(previousSnapshot?.status, status);
            const timestamp = resolvedStatus.shouldAdvanceTimestamps
                ? new Date().toISOString()
                : (previousSnapshot?.timestamp ?? previousSnapshot?.updatedAt ?? previousSnapshot?.createdAt ?? new Date().toISOString());

            const revision = await store.adjust(projectedTeamJobsRevisionKey(teamId), 1);

            const nextSnapshot: TeamJobSnapshot = {
                ...previousSnapshot,
                ...extra,
                jobId,
                teamId,
                queueType,
                status: resolvedStatus.status,
                timestamp,
                revision,
                updatedAt: resolvedStatus.shouldAdvanceTimestamps
                    ? timestamp
                    : (previousSnapshot?.updatedAt ?? timestamp),
                createdAt: previousSnapshot?.createdAt ?? timestamp,
                name: name ?? previousSnapshot?.name,
                message: message ?? previousSnapshot?.message,
                error: status === JobStatus.Failed ? (error ?? previousSnapshot?.error) : undefined,
                analysisId: analysisId ?? previousSnapshot?.analysisId,
                trajectoryId: trajectoryId ?? previousSnapshot?.trajectoryId,
                trajectoryName,
                timestep: timestep ?? previousSnapshot?.timestep,
                teamClusterId: teamClusterId ?? previousSnapshot?.teamClusterId,
                source: source ?? previousSnapshot?.source ?? 'projected',
                backingSource: backingSource ?? previousSnapshot?.backingSource ?? 'local',
                cleanupScope: cleanupScope ?? previousSnapshot?.cleanupScope
            };

            await store.set(jobStatusKey, JSON.stringify(nextSnapshot), { ttlMs: STATUS_TTL_MS });
            await store.setAdd(projectedTeamJobsKey(teamId), [jobId], { ttlMs: STATUS_TTL_MS });

            if (nextSnapshot.analysisId) {
                await store.setAdd(projectedAnalysisJobsKey(nextSnapshot.analysisId), [jobId], { ttlMs: STATUS_TTL_MS });
            }

            return nextSnapshot;
        });
    }

    private parseSnapshot(record: string | null): TeamJobSnapshot | null {
        if (!record) {
            return null;
        }

        return JSON.parse(record) as TeamJobSnapshot;
    }
}

export default new TeamJobProjectionService();
