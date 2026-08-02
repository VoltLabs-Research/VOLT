import redisClient from '@shared/infrastructure/redis/redisClient';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import objectGatewayClientSingleton from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import type SocketIOEmitter from '@modules/socket/services/SocketIOEmitter';
import Trajectory from '@modules/trajectory/models/Trajectory';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { TeamClusterDaemonExecutionLogSegment } from '@shared/contracts/types';
import { Buffer } from 'node:buffer';

export const ANALYSIS_LOG_SOCKET_EVENTS = {
    SUBSCRIBE: 'subscribe_to_analysis_log',
    UNSUBSCRIBE: 'unsubscribe_from_analysis_log',
    CHUNK: 'analysis-log:chunk'
} as const;

export type AnalysisExecutionLogSegment = TeamClusterDaemonExecutionLogSegment;
export type AnalysisFrameLogStatus = 'pending' | 'running' | 'completed' | 'failed';

interface AnalysisFrameLogSnapshot {
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

interface FrameLogRuntimeState {
    storageClusterId: string;
    record: StoredAnalysisFrameLogRecord | null;
    persistTimer: ReturnType<typeof setTimeout> | null;
    persisting: Promise<void>;
}

const MAX_LOG_BYTES = 16 * 1024 * 1024;

const PERSIST_DEBOUNCE_MS = 500;

const createTruncatedSegment = (): AnalysisExecutionLogSegment => ({
    stream: 'system',
    text: '[Volt] Execution log truncated after reaching the frame log size limit.\n',
    occurredAt: new Date().toISOString()
});

export const getAnalysisLogRoom = (analysisId: string, timestep: number): string => {
    return `analysis-log:${analysisId}:${timestep}`;
};

class AnalysisExecutionLogService {
    private readonly mutationChains = new Map<string, Promise<void>>();
    private readonly frameStates = new Map<string, FrameLogRuntimeState>();
    private readonly emitter: SocketIOEmitter = socketIOEmitter;

        private readonly redis = redisClient;

    #objectGatewayClientCache?: ITeamClusterObjectGatewayClient;
    private get objectGatewayClient(): ITeamClusterObjectGatewayClient {
        return (this.#objectGatewayClientCache ??= objectGatewayClientSingleton);
    }

    private async requireStorageClusterId(trajectoryId: string): Promise<string>{
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
        const storageClusterId = trajectory?.storageClusterId;

        if(!storageClusterId){
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
            const state = await this.loadRuntimeState(storageClusterId, input);
            const current = state.record;
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

            state.record = nextRecord;
            await this.flushRuntimeState(state);
        });
    }

    async appendFrameSegments(input: AppendFrameSegmentsInput): Promise<void> {
        const normalizedSegments = input.segments.filter((segment) => segment.text.length > 0);

        if (normalizedSegments.length === 0) {
            return;
        }

        const chunk = await this.runFrameLogMutation(input.analysisId, input.timestep, async () => {
            const storageClusterId = await this.requireStorageClusterId(input.trajectoryId);
            const state = await this.loadRuntimeState(storageClusterId, input);
            const current = state.record;
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

            record.segments.push(...acceptedSegments);
            const nextCursor = this.resolveCursor(null, record.segments.length);
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
                segments: record.segments
            };

            state.record = updatedRecord;
            this.schedulePersist(state);

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
            const state = await this.loadRuntimeState(storageClusterId, input);
            const current = state.record;
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

            state.record = updatedRecord;
            await this.flushRuntimeState(state);
            this.frameStates.delete(this.frameMutationKey(input.analysisId, input.timestep));

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

        const cached = this.frameStates.get(this.frameMutationKey(input.analysisId, input.timestep));
        const record = cached
            ? cached.record
            : await this.readStoredRecord(
                await this.requireStorageClusterId(input.trajectoryId),
                input
            );

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

        for (const [frameKey, state] of this.frameStates) {
            if (!frameKey.startsWith(`${analysisId}:`)) {
                continue;
            }

            if (state.persistTimer) {
                clearTimeout(state.persistTimer);
                state.persistTimer = null;
            }

            await state.persisting.catch(() => undefined);
            this.frameStates.delete(frameKey);
        }

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

    private async loadRuntimeState(
        storageClusterId: string,
        identity: Pick<MarkFrameRunningInput, 'analysisId' | 'teamId' | 'trajectoryId' | 'timestep'>
    ): Promise<FrameLogRuntimeState> {
        const frameKey = this.frameMutationKey(identity.analysisId, identity.timestep);
        const existing = this.frameStates.get(frameKey);
        if (existing) {
            return existing;
        }

        const record = await this.readStoredRecord(storageClusterId, identity);
        const state: FrameLogRuntimeState = {
            storageClusterId,
            record,
            persistTimer: null,
            persisting: Promise.resolve()
        };
        this.frameStates.set(frameKey, state);
        return state;
    }

    private schedulePersist(state: FrameLogRuntimeState): void {
        if (state.persistTimer) {
            clearTimeout(state.persistTimer);
        }

        state.persistTimer = setTimeout(() => {
            state.persistTimer = null;
            void this.flushRuntimeState(state).catch(() => undefined);
        }, PERSIST_DEBOUNCE_MS);
    }

    private async flushRuntimeState(state: FrameLogRuntimeState): Promise<void> {
        if (state.persistTimer) {
            clearTimeout(state.persistTimer);
            state.persistTimer = null;
        }

        state.persisting = state.persisting
            .catch(() => undefined)
            .then(() => {
                const record = state.record;
                return record ? this.writeStoredRecord(state.storageClusterId, record) : undefined;
            });

        await state.persisting;
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
            return JSON.parse(buffer.toString('utf8')) as StoredAnalysisFrameLogRecord;
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
        return record.bytes
            ?? record.segments.reduce((total, segment) => total + Buffer.byteLength(segment.text, 'utf8'), 0);
    }

    private normalizeCursor(value: string | null | undefined): string | null {
        if (!value || value.trim().length === 0) {
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

export default new AnalysisExecutionLogService();
