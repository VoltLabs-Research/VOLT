import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type IORedis from 'ioredis';
import type { JobStatusChangedEventPayload } from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type { TeamJobSnapshot } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';
import { JobStatus } from '@modules/jobs/domain/entities/Job';

const STATUS_TTL_SECONDS = 86400;
const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const PROJECTED_JOB_SOURCE = 'projected';
const LOCAL_PROJECTED_JOB_BACKING_SOURCE = 'local';
const MISSING_SNAPSHOT_SENTINEL = '__missing__';
const MAX_UPSERT_RETRIES = 8;

const UPSERT_PROJECTED_JOB_SNAPSHOT_SCRIPT = `
local expected = ARGV[1]
local nextSnapshotRaw = ARGV[2]
local ttl = tonumber(ARGV[3])
local linkAnalysis = ARGV[4] == '1'
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

const isTerminalStatus = (status?: TeamJobSnapshot['status']): boolean => {
    return status === JobStatus.Completed || status === JobStatus.Failed;
};

const resolveProjectedStatus = (
    previousStatus: TeamJobSnapshot['status'] | undefined,
    incomingStatus: JobStatusChangedEventPayload['status']
): {
    status: TeamJobSnapshot['status'];
    shouldAdvanceTimestamps: boolean;
} => {
    if (!previousStatus || previousStatus === incomingStatus) {
        return {
            status: incomingStatus,
            shouldAdvanceTimestamps: true
        };
    }

    if (incomingStatus === 'retrying') {
        return {
            status: incomingStatus,
            shouldAdvanceTimestamps: true
        };
    }

    if (isTerminalStatus(previousStatus)) {
        return {
            status: previousStatus,
            shouldAdvanceTimestamps: false
        };
    }

    if (
        previousStatus === JobStatus.Running
        && incomingStatus === JobStatus.Queued
    ) {
        return {
            status: previousStatus,
            shouldAdvanceTimestamps: false
        };
    }

    if (previousStatus === 'retrying' && incomingStatus === JobStatus.Queued) {
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

@injectable()
export default class TeamJobProjectionService {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    async upsertFromStatusChangedEvent(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot> {
        return this.upsertProjectedSnapshot(payload);
    }

    private async upsertProjectedSnapshot(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot> {
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
        const jobStatusKey = this.jobStatusKey(jobId);
        const projectedTeamJobsKey = this.projectedTeamJobsKey(teamId);
        const revisionKey = this.projectedTeamJobsRevisionKey(teamId);
        let previousRawSnapshot = await this.redis.get(jobStatusKey);
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
                error: error ?? previousSnapshot?.error,
                analysisId: analysisId ?? previousSnapshot?.analysisId,
                trajectoryId: trajectoryId ?? previousSnapshot?.trajectoryId,
                trajectoryName,
                timestep: timestep ?? previousSnapshot?.timestep,
                teamClusterId: teamClusterId ?? previousSnapshot?.teamClusterId,
                source: source ?? previousSnapshot?.source ?? PROJECTED_JOB_SOURCE,
                backingSource: backingSource ?? previousSnapshot?.backingSource ?? LOCAL_PROJECTED_JOB_BACKING_SOURCE,
                cleanupScope: cleanupScope ?? previousSnapshot?.cleanupScope
            };
            const nextSnapshotRaw = JSON.stringify(nextSnapshot);

            const result = await this.redis.eval(
                UPSERT_PROJECTED_JOB_SNAPSHOT_SCRIPT,
                4,
                jobStatusKey,
                projectedTeamJobsKey,
                this.projectedAnalysisJobsKey(nextSnapshot.analysisId ?? 'noop'),
                revisionKey,
                previousRawSnapshot ?? MISSING_SNAPSHOT_SENTINEL,
                nextSnapshotRaw,
                STATUS_TTL_SECONDS,
                nextSnapshot.analysisId ? '1' : '0'
            ) as [number, string] | null;

            if (Array.isArray(result) && result[0] === 1) {
                const persistedSnapshot = this.parseSnapshot(result[1]);
                if (!persistedSnapshot) {
                    throw new Error(`Failed to parse persisted projected job snapshot ${jobId}`);
                }

                return persistedSnapshot;
            }

            previousRawSnapshot = Array.isArray(result) && result[1]
                ? result[1]
                : null;
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

    private jobStatusKey(jobId: string): string {
        return `${JOB_STATUS_KEY_PREFIX}${jobId}`;
    }

    private projectedTeamJobsKey(teamId: string): string {
        return `team:${teamId}:projected-jobs`;
    }

    private projectedTeamJobsRevisionKey(teamId: string): string {
        return `team:${teamId}:projected-jobs:revision`;
    }

    private projectedAnalysisJobsKey(analysisId: string): string {
        return `analysis:${analysisId}:projected-jobs`;
    }
}
