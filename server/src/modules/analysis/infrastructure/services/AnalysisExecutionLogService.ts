import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { TeamClusterDaemonExecutionLogSegment } from '@modules/cluster/utilities/teamClusterSocket';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
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

interface StoredAnalysisFrameLogRecord extends AnalysisFrameLogSnapshot {
    jobId?: string;
    bytes?: number;
}

const MAX_LOG_BYTES = 16 * 1024 * 1024;

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
    private readonly mutationChains = new Map<string, Promise<void>>();

    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,
        private readonly emitter: SocketIOEmitter,
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    private async requireStorageClusterId(trajectoryId: string): Promise<string> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                `Trajectory ${trajectoryId} does not have a storage cluster assigned`
            );
        }

        return storageClusterId;
    }

    async markFrameRunning(input: MarkFrameRunningInput): Promise<void> {
        await this.runFrameLogMutation(input.analysisId, input.timestep, async () => {
            const storageClusterId = await this.requireStorageClusterId(input.trajectoryId);
            const current = await this.readStoredRecord(storageClusterId, input);
            if (current?.jobId === input.jobId && current.sealed) {
                return;
            }

            const shouldReset = !current || current.jobId !== input.jobId;
            const nextRecord = shouldReset
                ? this.createEmptyStoredRecord(input, 'running')
                : {
                    ...current,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    jobId: input.jobId,
                    status: 'running' as const,
                    sealed: false,
                    nextCursor: this.resolveCursor(current.nextCursor, current.segments.length),
                    bytes: this.resolveRecordBytes(current)
                };

            await this.writeStoredRecord(storageClusterId, nextRecord);
        });
    }

    async appendFrameSegments(input: AppendFrameSegmentsInput): Promise<void> {
        const normalizedSegments = input.segments
            .map(normalizeSegment)
            .filter((segment): segment is AnalysisExecutionLogSegment => segment !== null);

        if (normalizedSegments.length === 0) {
            return;
        }

        const chunk = await this.runFrameLogMutation(input.analysisId, input.timestep, async () => {
            const storageClusterId = await this.requireStorageClusterId(input.trajectoryId);
            const current = await this.readStoredRecord(storageClusterId, input);
            const record = !current || current.jobId !== input.jobId
                ? this.createEmptyStoredRecord(input, 'running')
                : current;

            if (record.truncated) {
                return null;
            }

            let totalBytes = this.resolveRecordBytes(record);
            const acceptedSegments: AnalysisExecutionLogSegment[] = [];
            let truncated = false;
            let appendedTruncationMarker = false;

            for (const segment of normalizedSegments) {
                const nextBytes = totalBytes + Buffer.byteLength(segment.text, 'utf8');
                if (nextBytes > MAX_LOG_BYTES) {
                    truncated = true;
                    acceptedSegments.push(createTruncatedSegment());
                    appendedTruncationMarker = true;
                    break;
                }

                acceptedSegments.push(segment);
                totalBytes = nextBytes;
            }

            if (acceptedSegments.length === 0 && !appendedTruncationMarker) {
                return null;
            }

            const nextSegments = [...record.segments, ...acceptedSegments];
            const nextCursor = this.resolveCursor(null, nextSegments.length);
            const nextStatus = record.sealed ? record.status : 'running';
            const updatedRecord: StoredAnalysisFrameLogRecord = {
                ...record,
                analysisId: input.analysisId,
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                timestep: input.timestep,
                jobId: input.jobId,
                status: nextStatus,
                sealed: record.sealed,
                truncated,
                nextCursor,
                bytes: totalBytes,
                segments: nextSegments
            };

            await this.writeStoredRecord(storageClusterId, updatedRecord);

            return {
                analysisId: input.analysisId,
                timestep: input.timestep,
                cursor: nextCursor,
                segments: acceptedSegments,
                sealed: updatedRecord.sealed,
                status: nextStatus,
                truncated
            };
        });

        if (chunk) {
            this.emitChunk(chunk);
        }
    }

    async sealFrameLog(input: SealFrameLogInput): Promise<void> {
        const chunk = await this.runFrameLogMutation(input.analysisId, input.timestep, async () => {
            const storageClusterId = await this.requireStorageClusterId(input.trajectoryId);
            const current = await this.readStoredRecord(storageClusterId, input);
            const record = !current || current.jobId !== input.jobId
                ? this.createEmptyStoredRecord(input, input.status)
                : current;
            const nextCursor = this.resolveCursor(record.nextCursor, record.segments.length);
            const updatedRecord: StoredAnalysisFrameLogRecord = {
                ...record,
                analysisId: input.analysisId,
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                timestep: input.timestep,
                jobId: input.jobId,
                status: input.status,
                sealed: true,
                nextCursor,
                bytes: this.resolveRecordBytes(record)
            };

            await this.writeStoredRecord(storageClusterId, updatedRecord);

            return {
                analysisId: input.analysisId,
                timestep: input.timestep,
                cursor: nextCursor,
                segments: [],
                sealed: true,
                status: input.status,
                truncated: updatedRecord.truncated
            };
        });

        this.emitChunk(chunk);
    }

    async getFrameLog(input: GetFrameLogInput): Promise<AnalysisFrameLogSnapshot> {
        await this.waitForFrameLogMutations(input.analysisId, input.timestep);

        const storageClusterId = await this.requireStorageClusterId(input.trajectoryId);
        const record = await this.readStoredRecord(storageClusterId, input);

        if (!record) {
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

        return this.buildSnapshot(record, input.afterCursor);
    }

    async clearRuntimeState(analysisId: string): Promise<void> {
        await Promise.all(
            [...this.mutationChains.entries()]
                .filter(([frameKey]) => frameKey.startsWith(`${analysisId}:`))
                .map(([, mutation]) => mutation.catch(() => undefined))
        );

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

    private storageObjectKey(trajectoryId: string, analysisId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/analysis-${analysisId}/frame-${timestep}.json`;
    }

    private frameMutationKey(analysisId: string, timestep: number): string {
        return `${analysisId}:${timestep}`;
    }

    private async runFrameLogMutation<TResult>(
        analysisId: string,
        timestep: number,
        operation: () => Promise<TResult>
    ): Promise<TResult> {
        const frameKey = this.frameMutationKey(analysisId, timestep);
        const previous = this.mutationChains.get(frameKey) ?? Promise.resolve();
        let releaseCurrent!: () => void;
        const current = new Promise<void>((resolve) => {
            releaseCurrent = resolve;
        });
        const tail = previous
            .catch(() => undefined)
            .then(() => current);

        this.mutationChains.set(frameKey, tail);

        try {
            await previous.catch(() => undefined);
            return await operation();
        } finally {
            releaseCurrent();
            if (this.mutationChains.get(frameKey) === tail) {
                this.mutationChains.delete(frameKey);
            }
        }
    }

    private async waitForFrameLogMutations(analysisId: string, timestep: number): Promise<void> {
        const pending = this.mutationChains.get(this.frameMutationKey(analysisId, timestep));
        if (!pending) {
            return;
        }

        await pending.catch(() => undefined);
    }

    private createEmptyStoredRecord(
        input: MarkFrameRunningInput,
        status: AnalysisFrameLogStatus
    ): StoredAnalysisFrameLogRecord {
        return {
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            jobId: input.jobId,
            status,
            sealed: status === 'completed' || status === 'failed',
            truncated: false,
            nextCursor: null,
            bytes: 0,
            segments: []
        };
    }

    private async readStoredRecord(
        storageClusterId: string,
        identity: Pick<MarkFrameRunningInput, 'analysisId' | 'teamId' | 'trajectoryId' | 'timestep'>
    ): Promise<StoredAnalysisFrameLogRecord | null> {
        try {
            const buffer = await this.objectGatewayClient.getBuffer(
                storageClusterId,
                TEAM_CLUSTER_BUCKETS.ANALYSIS_LOGS,
                this.storageObjectKey(identity.trajectoryId, identity.analysisId, identity.timestep)
            );
            return this.normalizeStoredRecord(JSON.parse(buffer.toString('utf8')) as unknown, identity);
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return null;
            }

            throw error;
        }
    }

    private async writeStoredRecord(
        storageClusterId: string,
        record: StoredAnalysisFrameLogRecord
    ): Promise<void> {
        const snapshotBuffer = Buffer.from(JSON.stringify(record), 'utf8');
        await this.objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.ANALYSIS_LOGS,
            objectKey: this.storageObjectKey(record.trajectoryId, record.analysisId, record.timestep),
            buffer: snapshotBuffer,
            contentLength: snapshotBuffer.length,
            contentType: 'application/json'
        });
    }

    private normalizeStoredRecord(
        value: unknown,
        identity: Pick<MarkFrameRunningInput, 'analysisId' | 'teamId' | 'trajectoryId' | 'timestep'>
    ): StoredAnalysisFrameLogRecord {
        if (typeof value !== 'object' || value === null) {
            return this.createEmptyStoredRecord({ ...identity, jobId: '' }, 'pending');
        }

        const record = value as Partial<StoredAnalysisFrameLogRecord>;
        const segments = Array.isArray(record.segments)
            ? record.segments
                .map((segment) => normalizeSegment(segment as AnalysisExecutionLogSegment))
                .filter((segment): segment is AnalysisExecutionLogSegment => segment !== null)
            : [];

        const normalized: StoredAnalysisFrameLogRecord = {
            analysisId: typeof record.analysisId === 'string' && record.analysisId.length > 0
                ? record.analysisId
                : identity.analysisId,
            teamId: typeof record.teamId === 'string' && record.teamId.length > 0
                ? record.teamId
                : identity.teamId,
            trajectoryId: typeof record.trajectoryId === 'string' && record.trajectoryId.length > 0
                ? record.trajectoryId
                : identity.trajectoryId,
            timestep: typeof record.timestep === 'number' && Number.isFinite(record.timestep)
                ? record.timestep
                : identity.timestep,
            jobId: typeof record.jobId === 'string' && record.jobId.length > 0
                ? record.jobId
                : undefined,
            status: this.resolveStatus(record.status),
            sealed: record.sealed === true,
            truncated: record.truncated === true,
            nextCursor: this.resolveCursor(this.normalizeCursor(record.nextCursor), segments.length),
            bytes: typeof record.bytes === 'number' && Number.isFinite(record.bytes)
                ? record.bytes
                : undefined,
            segments
        };

        return normalized;
    }

    private buildSnapshot(
        record: StoredAnalysisFrameLogRecord,
        afterCursor?: string
    ): AnalysisFrameLogSnapshot {
        const nextCursor = this.resolveCursor(record.nextCursor, record.segments.length);
        if (!afterCursor) {
            return {
                analysisId: record.analysisId,
                teamId: record.teamId,
                trajectoryId: record.trajectoryId,
                timestep: record.timestep,
                status: record.status,
                sealed: record.sealed,
                truncated: record.truncated,
                nextCursor,
                segments: [...record.segments]
            };
        }

        const replayOffset = this.parseCursorOffset(afterCursor);
        if (replayOffset === null) {
            return {
                analysisId: record.analysisId,
                teamId: record.teamId,
                trajectoryId: record.trajectoryId,
                timestep: record.timestep,
                status: record.status,
                sealed: record.sealed,
                truncated: record.truncated,
                nextCursor: nextCursor ?? this.normalizeCursor(afterCursor),
                segments: []
            };
        }

        return {
            analysisId: record.analysisId,
            teamId: record.teamId,
            trajectoryId: record.trajectoryId,
            timestep: record.timestep,
            status: record.status,
            sealed: record.sealed,
            truncated: record.truncated,
            nextCursor: nextCursor ?? this.normalizeCursor(afterCursor),
            segments: record.segments.slice(Math.max(0, replayOffset))
        };
    }

    private resolveRecordBytes(record: StoredAnalysisFrameLogRecord): number {
        if (typeof record.bytes === 'number' && Number.isFinite(record.bytes)) {
            return record.bytes;
        }

        return record.segments.reduce((total, segment) => total + Buffer.byteLength(segment.text, 'utf8'), 0);
    }

    private resolveStatus(status: string | undefined): AnalysisFrameLogStatus {
        if (isAnalysisFrameLogStatus(status)) {
            return status;
        }

        return 'running';
    }

    private normalizeCursor(value: string | null | undefined): string | null {
        if (typeof value !== 'string' || value.trim().length === 0) {
            return null;
        }

        return value;
    }

    private resolveCursor(value: string | null | undefined, segmentCount: number): string | null {
        const normalized = this.normalizeCursor(value);
        if (normalized) {
            return normalized;
        }

        return segmentCount > 0 ? `${segmentCount}` : null;
    }

    private parseCursorOffset(cursor: string): number | null {
        if (!/^\d+$/.test(cursor)) {
            return null;
        }

        const parsed = Number.parseInt(cursor, 10);
        return Number.isFinite(parsed) ? parsed : null;
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
