import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type IORedis from 'ioredis';
import type { JobStatusChangedEventPayload } from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type { TeamJobMetadata, TeamJobSnapshot } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';
import { JobStatus } from '@modules/jobs/domain/entities/Job';

const STATUS_TTL_SECONDS = 86400;
const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const PROJECTED_JOB_SOURCE = 'projected';
const LOCAL_PROJECTED_JOB_BACKING_SOURCE = 'local';
const MISSING_SNAPSHOT_SENTINEL = '__missing__';
const MAX_UPSERT_RETRIES = 8;
const LOCAL_SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000;

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
    private readonly pendingJobUpdates = new Map<string, Promise<void>>();
    private readonly localSnapshotCache = new Map<string, {
        rawSnapshot: string | null;
        parsedSnapshot: TeamJobSnapshot | null;
        expiresAt: number;
    }>();

    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    async upsertFromStatusChangedEvent(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot> {
        return this.runSerialized(payload.jobId, async () => this.upsertProjectedSnapshot(payload));
    }

    private async upsertProjectedSnapshot(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot> {
        const { jobId, teamId, status, queueType } = payload;
        const jobStatusKey = this.jobStatusKey(jobId);
        const projectedTeamJobsKey = this.projectedTeamJobsKey(teamId);
        const revisionKey = this.projectedTeamJobsRevisionKey(teamId);
        const cachedSnapshot = this.getCachedSnapshot(jobId);
        let previousRawSnapshot = cachedSnapshot?.rawSnapshot;
        let previousSnapshot = cachedSnapshot?.parsedSnapshot;

        if (typeof previousRawSnapshot === 'undefined') {
            previousRawSnapshot = await this.redis.get(jobStatusKey);
            previousSnapshot = this.parseSnapshot(previousRawSnapshot, jobId);
            this.cacheSnapshot(jobId, previousRawSnapshot, previousSnapshot);
        }

        for (let attempt = 0; attempt < MAX_UPSERT_RETRIES; attempt += 1) {
            const resolvedStatus = resolveProjectedStatus(previousSnapshot?.status, status);
            const timestamp = resolvedStatus.shouldAdvanceTimestamps
                ? new Date().toISOString()
                : (previousSnapshot?.timestamp ?? previousSnapshot?.updatedAt ?? previousSnapshot?.createdAt ?? new Date().toISOString());
            const metadata = this.buildMetadata(previousSnapshot?.metadata, payload.metadata, resolvedStatus.status);
            const analysisId = this.resolveString(
                payload.metadata?.analysisId,
                previousSnapshot?.analysisId,
                metadata.analysisId
            );

            const nextSnapshot: TeamJobSnapshot = {
                ...previousSnapshot,
                jobId,
                teamId,
                queueType,
                status: resolvedStatus.status,
                metadata,
                timestamp,
                updatedAt: resolvedStatus.shouldAdvanceTimestamps
                    ? timestamp
                    : (previousSnapshot?.updatedAt ?? timestamp),
                createdAt: previousSnapshot?.createdAt ?? timestamp,
                name: this.resolveString(payload.metadata?.name, previousSnapshot?.name, metadata.name),
                message: this.resolveString(payload.metadata?.message, previousSnapshot?.message, metadata.message),
                analysisId,
                trajectoryId: this.resolveString(payload.metadata?.trajectoryId, previousSnapshot?.trajectoryId, metadata.trajectoryId),
                trajectoryName: this.resolveString(
                    payload.metadata?.trajectoryName,
                    previousSnapshot?.trajectoryName,
                    metadata.trajectoryName
                ),
                timestep: this.resolveNumber(payload.metadata?.timestep, previousSnapshot?.timestep, metadata.timestep),
                teamClusterId: this.resolveString(payload.metadata?.teamClusterId, previousSnapshot?.teamClusterId),
                source: this.resolveString(payload.metadata?.source, previousSnapshot?.source, PROJECTED_JOB_SOURCE),
                backingSource: this.resolveString(payload.metadata?.backingSource, previousSnapshot?.backingSource, LOCAL_PROJECTED_JOB_BACKING_SOURCE),
                cleanupScope: this.resolveString(payload.metadata?.cleanupScope, previousSnapshot?.cleanupScope)
            };
            const nextSnapshotRaw = JSON.stringify(nextSnapshot);

            const result = await this.redis.eval(
                UPSERT_PROJECTED_JOB_SNAPSHOT_SCRIPT,
                4,
                jobStatusKey,
                projectedTeamJobsKey,
                this.projectedAnalysisJobsKey(analysisId ?? 'noop'),
                revisionKey,
                previousRawSnapshot ?? MISSING_SNAPSHOT_SENTINEL,
                nextSnapshotRaw,
                STATUS_TTL_SECONDS,
                analysisId ? '1' : '0'
            ) as [number, string] | null;

            if (Array.isArray(result) && result[0] === 1) {
                const persistedSnapshot = this.parseSnapshot(result[1], jobId);
                if (!persistedSnapshot) {
                    throw new Error(`Failed to parse persisted projected job snapshot ${jobId}`);
                }

                this.cacheSnapshot(jobId, result[1], persistedSnapshot);

                return persistedSnapshot;
            }

            previousRawSnapshot = Array.isArray(result) && result[1]
                ? result[1]
                : null;
            previousSnapshot = this.parseSnapshot(previousRawSnapshot, jobId);
            this.cacheSnapshot(jobId, previousRawSnapshot, previousSnapshot);
        }

        throw new Error(`Failed to atomically upsert projected team job snapshot ${jobId}`);
    }

    private async runSerialized<T>(jobId: string, operation: () => Promise<T>): Promise<T> {
        const previousOperation = this.pendingJobUpdates.get(jobId) ?? Promise.resolve();
        const resultPromise = previousOperation
            .catch(() => undefined)
            .then(operation);
        const trackedPromise = resultPromise.then(() => undefined, () => undefined);

        this.pendingJobUpdates.set(jobId, trackedPromise);

        try {
            return await resultPromise;
        } finally {
            if (this.pendingJobUpdates.get(jobId) === trackedPromise) {
                this.pendingJobUpdates.delete(jobId);
            }
        }
    }

    private buildMetadata(
        previousMetadata?: TeamJobMetadata,
        incomingMetadata?: JobStatusChangedEventPayload['metadata'],
        resolvedStatus?: TeamJobSnapshot['status']
    ): TeamJobMetadata {
        const metadata: TeamJobMetadata = {
            ...(previousMetadata ?? {}),
            ...(incomingMetadata ?? {})
        };

        metadata.jobId = this.resolveString(incomingMetadata?.jobId, metadata.jobId);
        metadata.status = this.resolveString(resolvedStatus, incomingMetadata?.status, metadata.status);
        metadata.queueType = this.resolveString(incomingMetadata?.queueType, metadata.queueType);
        metadata.source = this.resolveString(incomingMetadata?.source, metadata.source, PROJECTED_JOB_SOURCE);
        metadata.backingSource = this.resolveString(
            incomingMetadata?.backingSource,
            metadata.backingSource,
            LOCAL_PROJECTED_JOB_BACKING_SOURCE
        );

        return metadata;
    }

    private parseSnapshot(record: string | null, jobId: string): TeamJobSnapshot | null {
        if (!record) {
            return null;
        }

        try {
            const parsedRecord: unknown = JSON.parse(record);
            if (!this.isRecord(parsedRecord)) {
                return null;
            }

            return parsedRecord as TeamJobSnapshot;
        } catch (error) {
            logger.warn(error, `[TeamJobProjectionService] Failed to parse projected team job snapshot ${jobId}`);

            return null;
        }
    }

    private getCachedSnapshot(jobId: string): {
        rawSnapshot: string | null;
        parsedSnapshot: TeamJobSnapshot | null;
    } | null {
        const cachedSnapshot = this.localSnapshotCache.get(jobId);
        if (!cachedSnapshot) {
            return null;
        }

        if (cachedSnapshot.expiresAt <= Date.now()) {
            this.localSnapshotCache.delete(jobId);
            return null;
        }

        return {
            rawSnapshot: cachedSnapshot.rawSnapshot,
            parsedSnapshot: cachedSnapshot.parsedSnapshot
        };
    }

    private cacheSnapshot(
        jobId: string,
        rawSnapshot: string | null,
        parsedSnapshot: TeamJobSnapshot | null
    ): void {
        this.localSnapshotCache.set(jobId, {
            rawSnapshot,
            parsedSnapshot,
            expiresAt: Date.now() + LOCAL_SNAPSHOT_CACHE_TTL_MS
        });
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    private resolveString(...candidates: unknown[]): string | undefined {
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim().length > 0) {
                return candidate;
            }
        }

        return undefined;
    }

    private resolveNumber(...candidates: unknown[]): number | undefined {
        for (const candidate of candidates) {
            if (typeof candidate === 'number' && Number.isFinite(candidate)) {
                return candidate;
            }

            if (typeof candidate === 'string' && candidate.trim().length > 0) {
                const parsedCandidate = Number(candidate);
                if (Number.isFinite(parsedCandidate)) {
                    return parsedCandidate;
                }
            }
        }

        return undefined;
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
