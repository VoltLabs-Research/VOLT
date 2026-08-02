import redisClient from '@shared/infrastructure/redis/redisClient';
import type { JobStatusChangedEventPayload } from '@shared/contracts/events';
import type { TeamJobSnapshot } from '@shared/contracts/types/TeamJobSnapshot';
import { JobStatus } from '@shared/contracts/types/JobStatus';
import {
    jobStatusKey as buildJobStatusKey,
    jobTombstoneKey,
    projectedTeamJobsKey,
    projectedTeamJobsRevisionKey,
    projectedAnalysisJobsKey
} from '@modules/jobs/services/JobRedisKeys';

const STATUS_TTL_SECONDS = 86400;
const MISSING_SNAPSHOT_SENTINEL = '__missing__';
const TOMBSTONED_SENTINEL = '__tombstoned__';
const MAX_UPSERT_RETRIES = 8;

const UPSERT_PROJECTED_JOB_SNAPSHOT_SCRIPT = `
local expected = ARGV[1]
local nextSnapshotRaw = ARGV[2]
local ttl = tonumber(ARGV[3])
local linkAnalysis = ARGV[4] == '1'

if redis.call('EXISTS', KEYS[5]) == 1 then
    return {-1, '${TOMBSTONED_SENTINEL}'}
end

local current = redis.call('GET', KEYS[1])

if expected == '${MISSING_SNAPSHOT_SENTINEL}' then
    if current then
        return {0, current}
    end
elseif current ~= expected then
    return {0, current or ''}
end

local revision = redis.call('INCR', KEYS[4])
local snapshot = cjson.decode(nextSnapshotRaw)
snapshot.revision = revision
local snapshotJson = cjson.encode(snapshot)

redis.call('SET', KEYS[1], snapshotJson, 'EX', ttl)
redis.call('SADD', KEYS[2], snapshot.jobId)
redis.call('EXPIRE', KEYS[2], ttl)

if linkAnalysis then
    redis.call('SADD', KEYS[3], snapshot.jobId)
    redis.call('EXPIRE', KEYS[3], ttl)
end

return {1, snapshotJson}
`;

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
        let previousRawSnapshot = await redisClient.get(jobStatusKey);
        let previousSnapshot = this.parseSnapshot(previousRawSnapshot);

        for (let attempt = 0; attempt < MAX_UPSERT_RETRIES; attempt += 1) {
            const resolvedStatus = resolveProjectedStatus(previousSnapshot?.status, status);
            const timestamp = resolvedStatus.shouldAdvanceTimestamps
                ? new Date().toISOString()
                : (previousSnapshot?.timestamp ?? previousSnapshot?.updatedAt ?? previousSnapshot?.createdAt ?? new Date().toISOString());

            const nextSnapshot: TeamJobSnapshot = {
                ...previousSnapshot,
                ...extra,
                jobId,
                teamId,
                queueType,
                status: resolvedStatus.status,
                timestamp,
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
            const nextSnapshotRaw = JSON.stringify(nextSnapshot);

            const result = await redisClient.eval(
                UPSERT_PROJECTED_JOB_SNAPSHOT_SCRIPT,
                5,
                jobStatusKey,
                projectedTeamJobsKey(teamId),
                projectedAnalysisJobsKey(nextSnapshot.analysisId ?? 'noop'),
                projectedTeamJobsRevisionKey(teamId),
                jobTombstoneKey(jobId),
                previousRawSnapshot ?? MISSING_SNAPSHOT_SENTINEL,
                nextSnapshotRaw,
                STATUS_TTL_SECONDS,
                nextSnapshot.analysisId ? '1' : '0'
            ) as [number, string] | null;

            if (result?.[0] === -1) {
                return null;
            }

            if (result?.[0] === 1) {
                const persistedSnapshot = this.parseSnapshot(result[1]);
                if (!persistedSnapshot) {
                    throw new Error(`Failed to parse persisted projected job snapshot ${jobId}`);
                }

                return persistedSnapshot;
            }

            previousRawSnapshot = result?.[1] || null;
            previousSnapshot = this.parseSnapshot(previousRawSnapshot);
        }

        throw new Error(`Failed to atomically upsert projected team job snapshot ${jobId}`);
    }

    private parseSnapshot(record: string | null): TeamJobSnapshot | null {
        if (!record) {
            return null;
        }

        return JSON.parse(record) as TeamJobSnapshot;
    }
}

export default new TeamJobProjectionService();
