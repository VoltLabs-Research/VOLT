import { SYS_BUCKETS } from '@core/config/minio';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import type { TeamClusterDaemonExecutionLogSegment } from '@modules/cluster/utilities/teamClusterSocket';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import type IORedis from 'ioredis';
import { Buffer } from 'node:buffer';
import { inject } from 'tsyringe';

export const ANALYSIS_LOG_SOCKET_EVENTS = {
    SUBSCRIBE: 'subscribe_to_analysis_log',
    UNSUBSCRIBE: 'unsubscribe_from_analysis_log',
    CHUNK: 'analysis-log:chunk'
} as const;

export type AnalysisExecutionLogSegment = TeamClusterDaemonExecutionLogSegment;
export type AnalysisFrameLogStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalysisFrameLogSnapshot {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    status: AnalysisFrameLogStatus;
    sealed: boolean;
    truncated: boolean;
    nextCursor: string | null;
    segments: AnalysisExecutionLogSegment[];
}

export interface AnalysisLogChunkEventPayload {
    analysisId: string;
    timestep: number;
    cursor: string | null;
    segments: AnalysisExecutionLogSegment[];
    sealed: boolean;
    status: AnalysisFrameLogStatus;
    truncated: boolean;
}

interface MarkFrameRunningInput {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    jobId: string;
    timestep: number;
}

interface AppendFrameSegmentsInput extends MarkFrameRunningInput {
    segments: AnalysisExecutionLogSegment[];
}

interface SealFrameLogInput extends MarkFrameRunningInput {
    status: Extract<AnalysisFrameLogStatus, 'completed' | 'failed'>;
}

interface GetFrameLogInput {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    afterCursor?: string;
}

interface ParsedRedisSegment {
    cursor: string;
    segment: AnalysisExecutionLogSegment;
}

interface LogMetaRecord {
    analysisId?: string;
    teamId?: string;
    trajectoryId?: string;
    jobId?: string;
    status?: AnalysisFrameLogStatus;
    sealed?: '0' | '1';
    truncated?: '0' | '1';
    bytes?: string;
    lastCursor?: string;
}

const MAX_LOG_BYTES = 16 * 1024 * 1024;
const SEALED_REDIS_TTL_SECONDS = 24 * 60 * 60;
const STREAM_KEY_SUFFIX = 'stream';
const META_KEY_SUFFIX = 'meta';

const isAnalysisFrameLogStatus = (value: string | undefined): value is AnalysisFrameLogStatus => {
    return value === 'pending' || value === 'running' || value === 'completed' || value === 'failed';
};

const normalizeSegmentText = (value: unknown): string => {
    return typeof value === 'string' ? value : '';
};

const normalizeSegment = (segment: AnalysisExecutionLogSegment): AnalysisExecutionLogSegment | null => {
    const text = normalizeSegmentText(segment.text);
    if (text.length === 0) {
        return null;
    }

    return {
        stream: segment.stream,
        text,
        occurredAt: typeof segment.occurredAt === 'string' && segment.occurredAt.length > 0
            ? segment.occurredAt
            : new Date().toISOString(),
        nodeId: typeof segment.nodeId === 'string' ? segment.nodeId : undefined,
        nodeType: typeof segment.nodeType === 'string' ? segment.nodeType : undefined,
        nodeLabel: typeof segment.nodeLabel === 'string' ? segment.nodeLabel : undefined,
        pluginId: typeof segment.pluginId === 'string' ? segment.pluginId : undefined,
        executionPath: Array.isArray(segment.executionPath)
            ? segment.executionPath.filter((value): value is string => typeof value === 'string' && value.length > 0)
            : undefined
    };
};

const createTruncatedSegment = (): AnalysisExecutionLogSegment => ({
    stream: 'system',
    text: '[Volt] Execution log truncated after reaching the frame log size limit.\n',
    occurredAt: new Date().toISOString()
});

export const getAnalysisLogRoom = (analysisId: string, timestep: number): string => {
    return `analysis-log:${analysisId}:${timestep}`;
};

@Singleton()
export default class AnalysisExecutionLogService {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly emitter: SocketIOEmitter
    ) {}

    async markFrameRunning(input: MarkFrameRunningInput): Promise<void> {
        const metaKey = this.metaKey(input.analysisId, input.timestep);
        const streamKey = this.streamKey(input.analysisId, input.timestep);
        const currentMeta = await this.redis.hgetall(metaKey) as LogMetaRecord;
        const shouldReset = currentMeta.jobId !== input.jobId || currentMeta.sealed === '1';

        const pipeline = this.redis.pipeline();

        if (shouldReset) {
            pipeline.del(streamKey);
            pipeline.del(metaKey);
        }

        pipeline.hset(metaKey, this.createMetaRecord({
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            jobId: input.jobId,
            status: 'running',
            sealed: false,
            truncated: false,
            bytes: shouldReset ? 0 : this.parseNumber(currentMeta.bytes),
            lastCursor: shouldReset ? null : this.normalizeCursor(currentMeta.lastCursor)
        }));
        pipeline.persist(metaKey);
        pipeline.persist(streamKey);

        await pipeline.exec();
    }

    async appendFrameSegments(input: AppendFrameSegmentsInput): Promise<void> {
        const normalizedSegments = input.segments
            .map(normalizeSegment)
            .filter((segment): segment is AnalysisExecutionLogSegment => segment !== null);

        if (normalizedSegments.length === 0) {
            return;
        }

        const metaKey = this.metaKey(input.analysisId, input.timestep);
        const streamKey = this.streamKey(input.analysisId, input.timestep);
        const meta = await this.redis.hgetall(metaKey) as LogMetaRecord;

        if (meta.sealed === '1') {
            return;
        }

        let totalBytes = this.parseNumber(meta.bytes);
        const acceptedSegments: AnalysisExecutionLogSegment[] = [];
        let truncated = meta.truncated === '1';
        let appendedTruncationMarker = false;

        for (const segment of normalizedSegments) {
            if (truncated) {
                break;
            }

            const nextBytes = totalBytes + Buffer.byteLength(segment.text, 'utf8');
            if (nextBytes > MAX_LOG_BYTES) {
                truncated = true;
                if (meta.truncated !== '1') {
                    acceptedSegments.push(createTruncatedSegment());
                    appendedTruncationMarker = true;
                }
                break;
            }

            acceptedSegments.push(segment);
            totalBytes = nextBytes;
        }

        if (acceptedSegments.length === 0 && !appendedTruncationMarker) {
            return;
        }

        const pipeline = this.redis.pipeline();
        for (const segment of acceptedSegments) {
            pipeline.xadd(streamKey, '*', 'segment', JSON.stringify(segment));
        }
        pipeline.hset(metaKey, this.createMetaRecord({
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            jobId: input.jobId,
            status: 'running',
            sealed: false,
            truncated,
            bytes: totalBytes,
            lastCursor: this.normalizeCursor(meta.lastCursor)
        }));
        pipeline.persist(metaKey);
        pipeline.persist(streamKey);

        const results = await pipeline.exec();
        const xaddResults = results
            ?.slice(0, acceptedSegments.length)
            .map((result) => (typeof result?.[1] === 'string' ? result[1] : null))
            .filter((value): value is string => value !== null) ?? [];

        const latestCursor = xaddResults[xaddResults.length - 1]
            ?? this.normalizeCursor(meta.lastCursor);
        if (latestCursor) {
            await this.redis.hset(metaKey, 'lastCursor', latestCursor);
        }

        this.emitChunk({
            analysisId: input.analysisId,
            timestep: input.timestep,
            cursor: latestCursor,
            segments: acceptedSegments,
            sealed: false,
            status: 'running',
            truncated
        });
    }

    async sealFrameLog(input: SealFrameLogInput): Promise<void> {
        const streamKey = this.streamKey(input.analysisId, input.timestep);
        const metaKey = this.metaKey(input.analysisId, input.timestep);
        const meta = await this.redis.hgetall(metaKey) as LogMetaRecord;
        const redisSegments = await this.readRedisSegments(streamKey);
        const segments = redisSegments.map((entry) => entry.segment);
        const lastCursor = redisSegments[redisSegments.length - 1]?.cursor
            ?? this.normalizeCursor(meta.lastCursor);
        const truncated = meta.truncated === '1';
        const snapshot: AnalysisFrameLogSnapshot = {
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            status: input.status,
            sealed: true,
            truncated,
            nextCursor: lastCursor,
            segments
        };

        await this.storageService.upload(
            SYS_BUCKETS.ANALYSIS_LOGS,
            this.storageObjectKey(input.trajectoryId, input.analysisId, input.timestep),
            Buffer.from(JSON.stringify(snapshot), 'utf8'),
            {
                'content-type': 'application/json'
            }
        );

        const pipeline = this.redis.pipeline();
        pipeline.hset(metaKey, this.createMetaRecord({
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            jobId: input.jobId,
            status: input.status,
            sealed: true,
            truncated,
            bytes: this.parseNumber(meta.bytes),
            lastCursor
        }));
        pipeline.expire(metaKey, SEALED_REDIS_TTL_SECONDS);
        pipeline.expire(streamKey, SEALED_REDIS_TTL_SECONDS);

        await pipeline.exec();

        this.emitChunk({
            analysisId: input.analysisId,
            timestep: input.timestep,
            cursor: lastCursor,
            segments: [],
            sealed: true,
            status: input.status,
            truncated
        });
    }

    async getFrameLog(input: GetFrameLogInput): Promise<AnalysisFrameLogSnapshot> {
        const streamKey = this.streamKey(input.analysisId, input.timestep);
        const metaKey = this.metaKey(input.analysisId, input.timestep);
        const meta = await this.redis.hgetall(metaKey) as LogMetaRecord;
        const hasRedisState = Object.keys(meta).length > 0 || await this.redis.exists(streamKey) === 1;

        if (hasRedisState) {
            const redisSegments = await this.readRedisSegments(streamKey, input.afterCursor);
            const lastCursor = redisSegments[redisSegments.length - 1]?.cursor
                ?? this.normalizeCursor(meta.lastCursor)
                ?? this.normalizeCursor(input.afterCursor);

            return {
                analysisId: input.analysisId,
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                timestep: input.timestep,
                status: this.resolveStatus(meta.status),
                sealed: meta.sealed === '1',
                truncated: meta.truncated === '1',
                nextCursor: lastCursor,
                segments: redisSegments.map((entry) => entry.segment)
            };
        }

        const objectName = this.storageObjectKey(input.trajectoryId, input.analysisId, input.timestep);
        if (await this.storageService.exists(SYS_BUCKETS.ANALYSIS_LOGS, objectName)) {
            const buffer = await this.storageService.getBuffer(SYS_BUCKETS.ANALYSIS_LOGS, objectName);
            const parsed = JSON.parse(buffer.toString('utf8')) as AnalysisFrameLogSnapshot;

            if (input.afterCursor) {
                return {
                    ...parsed,
                    segments: [],
                    nextCursor: parsed.nextCursor ?? input.afterCursor
                };
            }

            return parsed;
        }

        return {
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            status: 'pending',
            sealed: false,
            truncated: false,
            nextCursor: this.normalizeCursor(input.afterCursor),
            segments: []
        };
    }

    async clearRuntimeState(analysisId: string): Promise<void> {
        const keys = await this.scanKeys(`analysis-log:${analysisId}:*`);
        if (keys.length === 0) {
            return;
        }

        await this.redis.del(...keys);
    }

    private emitChunk(payload: AnalysisLogChunkEventPayload): void {
        this.emitter.emitToRoom(
            getAnalysisLogRoom(payload.analysisId, payload.timestep),
            ANALYSIS_LOG_SOCKET_EVENTS.CHUNK,
            payload
        );
    }

    private streamKey(analysisId: string, timestep: number): string {
        return `analysis-log:${analysisId}:${timestep}:${STREAM_KEY_SUFFIX}`;
    }

    private metaKey(analysisId: string, timestep: number): string {
        return `analysis-log:${analysisId}:${timestep}:${META_KEY_SUFFIX}`;
    }

    private storageObjectKey(trajectoryId: string, analysisId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/analysis-${analysisId}/frame-${timestep}.json`;
    }

    private createMetaRecord(input: {
        analysisId: string;
        teamId: string;
        trajectoryId: string;
        jobId: string;
        status: AnalysisFrameLogStatus;
        sealed: boolean;
        truncated: boolean;
        bytes: number;
        lastCursor: string | null;
    }): Record<string, string> {
        const record: Record<string, string> = {
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            jobId: input.jobId,
            status: input.status,
            sealed: input.sealed ? '1' : '0',
            truncated: input.truncated ? '1' : '0',
            bytes: input.bytes.toString()
        };

        if (input.lastCursor) {
            record.lastCursor = input.lastCursor;
        }

        return record;
    }

    private resolveStatus(status: string | undefined): AnalysisFrameLogStatus {
        if (isAnalysisFrameLogStatus(status)) {
            return status;
        }

        return 'running';
    }

    private parseNumber(value: string | undefined): number {
        const parsed = Number.parseInt(value ?? '0', 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private normalizeCursor(value: string | null | undefined): string | null {
        if (typeof value !== 'string' || value.trim().length === 0) {
            return null;
        }

        return value;
    }

    private async readRedisSegments(
        streamKey: string,
        afterCursor?: string
    ): Promise<ParsedRedisSegment[]> {
        const start = afterCursor ? `(${afterCursor}` : '-';
        const entries = await this.redis.xrange(streamKey, start, '+');

        return entries
            .map((entry) => {
                const [cursor, fields] = entry;
                const segmentFieldIndex = fields.findIndex((field) => field === 'segment');
                const serializedSegment = segmentFieldIndex >= 0 ? fields[segmentFieldIndex + 1] : undefined;
                if (typeof serializedSegment !== 'string') {
                    return null;
                }

                try {
                    return {
                        cursor,
                        segment: JSON.parse(serializedSegment) as AnalysisExecutionLogSegment
                    };
                } catch (error: unknown) {
                    logger.warn(`Failed to parse analysis log segment from Redis stream cursor=${cursor}`);
                    return null;
                }
            })
            .filter((entry): entry is ParsedRedisSegment => entry !== null);
    }

    private async scanKeys(pattern: string): Promise<string[]> {
        let cursor = '0';
        const keys: string[] = [];

        do {
            const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
            cursor = nextCursor;
            keys.push(...batch);
        } while (cursor !== '0');

        return keys;
    }
}
