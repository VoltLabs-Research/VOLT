import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type IORedis from 'ioredis';
import type { JobStatusChangedEventPayload } from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type { TeamJobMetadata, TeamJobSnapshot } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';

const STATUS_TTL_SECONDS = 86400;
const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const PROJECTED_JOB_SOURCE = 'projected';
const LOCAL_PROJECTED_JOB_BACKING_SOURCE = 'local';

@injectable()
export default class TeamJobProjectionService {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    async upsertFromStatusChangedEvent(payload: JobStatusChangedEventPayload): Promise<TeamJobSnapshot> {
        const { jobId, teamId, status, queueType } = payload;
        const previousSnapshot = await this.loadSnapshot(jobId);
        const timestamp = new Date().toISOString();
        const metadata = this.buildMetadata(previousSnapshot?.metadata, payload.metadata);
        const analysisId = this.resolveString(
            payload.metadata?.analysisId,
            previousSnapshot?.analysisId,
            metadata.analysisId
        );

        const snapshot: TeamJobSnapshot = {
            ...previousSnapshot,
            jobId,
            teamId,
            queueType,
            status,
            metadata,
            timestamp,
            updatedAt: timestamp,
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

        const pipeline = this.redis.pipeline();
        pipeline.set(this.jobStatusKey(jobId), JSON.stringify(snapshot), 'EX', STATUS_TTL_SECONDS);
        pipeline.sadd(this.teamJobsKey(teamId), jobId);
        pipeline.sadd(this.projectedTeamJobsKey(teamId), jobId);
        pipeline.expire(this.teamJobsKey(teamId), STATUS_TTL_SECONDS);
        pipeline.expire(this.projectedTeamJobsKey(teamId), STATUS_TTL_SECONDS);

        if (analysisId) {
            pipeline.sadd(this.projectedAnalysisJobsKey(analysisId), jobId);
            pipeline.expire(this.projectedAnalysisJobsKey(analysisId), STATUS_TTL_SECONDS);
        }

        await pipeline.exec();

        return snapshot;
    }

    private buildMetadata(
        previousMetadata?: TeamJobMetadata,
        incomingMetadata?: JobStatusChangedEventPayload['metadata']
    ): TeamJobMetadata {
        const metadata: TeamJobMetadata = {
            ...(previousMetadata ?? {}),
            ...(incomingMetadata ?? {})
        };

        metadata.jobId = this.resolveString(incomingMetadata?.jobId, metadata.jobId);
        metadata.status = this.resolveString(incomingMetadata?.status, metadata.status);
        metadata.queueType = this.resolveString(incomingMetadata?.queueType, metadata.queueType);
        metadata.source = this.resolveString(incomingMetadata?.source, metadata.source, PROJECTED_JOB_SOURCE);
        metadata.backingSource = this.resolveString(
            incomingMetadata?.backingSource,
            metadata.backingSource,
            LOCAL_PROJECTED_JOB_BACKING_SOURCE
        );

        return metadata;
    }

    private async loadSnapshot(jobId: string): Promise<TeamJobSnapshot | null> {
        const record = await this.redis.get(this.jobStatusKey(jobId));
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

    private teamJobsKey(teamId: string): string {
        return `team:${teamId}:jobs`;
    }

    private projectedTeamJobsKey(teamId: string): string {
        return `team:${teamId}:projected-jobs`;
    }

    private projectedAnalysisJobsKey(analysisId: string): string {
        return `analysis:${analysisId}:projected-jobs`;
    }
}
