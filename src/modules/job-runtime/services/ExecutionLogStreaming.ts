import { logger } from '@/core/logger';
import type { DaemonJobReporterService } from '@/modules/cloud-control/services';
import type {
    ProcessExecutionLogChunk,
    ProcessExecutionLogSink
} from './BinaryExecutorService';
import type { TeamClusterDaemonExecutionLogSegment } from '@/shared/contracts';

const DEFAULT_FLUSH_INTERVAL_MS = 250;
const DEFAULT_MAX_BUFFERED_BYTES = 8 * 1024;

export interface ExecutionLogSegmentMetadata {
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
}

interface BufferedExecutionLogSinkOptions {
    flushSegments: (segments: TeamClusterDaemonExecutionLogSegment[]) => Promise<void>;
    metadata?: ExecutionLogSegmentMetadata;
    flushIntervalMs?: number;
    maxBufferedBytes?: number;
}

interface AnalysisExecutionLogSinkOptions {
    reporter: Pick<DaemonJobReporterService, 'reportAnalysisLogChunk'>;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timesteps: number[];
    metadata?: ExecutionLogSegmentMetadata;
    flushIntervalMs?: number;
    maxBufferedBytes?: number;
}

interface DebugExecutionLogSinkOptions {
    reporter: Pick<DaemonJobReporterService, 'reportDebugLogChunk'>;
    sessionId: string;
    nodeId: string;
    metadata?: ExecutionLogSegmentMetadata;
    flushIntervalMs?: number;
    maxBufferedBytes?: number;
}

class BufferedExecutionLogSink implements ProcessExecutionLogSink {
    private readonly flushIntervalMs: number;
    private readonly maxBufferedBytes: number;
    private readonly metadata?: ExecutionLogSegmentMetadata;
    private readonly flushSegments: BufferedExecutionLogSinkOptions['flushSegments'];
    private buffer: TeamClusterDaemonExecutionLogSegment[] = [];
    private bufferedBytes = 0;
    private flushTimer: NodeJS.Timeout | null = null;
    private flushQueue: Promise<void> = Promise.resolve();

    constructor(options: BufferedExecutionLogSinkOptions) {
        this.flushSegments = options.flushSegments;
        this.metadata = options.metadata;
        this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
        this.maxBufferedBytes = options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
    }

    handleChunk(chunk: ProcessExecutionLogChunk): void {
        if (!chunk.text) {
            return;
        }

        const segment: TeamClusterDaemonExecutionLogSegment = {
            stream: chunk.stream,
            text: chunk.text,
            occurredAt: chunk.occurredAt,
            ...(this.metadata?.nodeId ? { nodeId: this.metadata.nodeId } : {}),
            ...(this.metadata?.nodeType ? { nodeType: this.metadata.nodeType } : {}),
            ...(this.metadata?.nodeLabel ? { nodeLabel: this.metadata.nodeLabel } : {}),
            ...(this.metadata?.pluginId ? { pluginId: this.metadata.pluginId } : {}),
            ...(Array.isArray(this.metadata?.executionPath) && this.metadata.executionPath.length > 0
                ? { executionPath: [...this.metadata.executionPath] }
                : {})
        };

        this.buffer.push(segment);
        this.bufferedBytes += Buffer.byteLength(segment.text, 'utf8');

        if (this.bufferedBytes >= this.maxBufferedBytes) {
            this.scheduleImmediateFlush();
            return;
        }

        this.scheduleDeferredFlush();
    }

    async flush(): Promise<void> {
        this.clearFlushTimer();
        await this.enqueueFlush();
    }

    private scheduleDeferredFlush(): void {
        if (this.flushTimer) {
            return;
        }

        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.enqueueFlush();
        }, this.flushIntervalMs);

        if (this.flushTimer.unref) {
            this.flushTimer.unref();
        }
    }

    private scheduleImmediateFlush(): void {
        this.clearFlushTimer();
        this.enqueueFlush();
    }

    private clearFlushTimer(): void {
        if (!this.flushTimer) {
            return;
        }

        clearTimeout(this.flushTimer);
        this.flushTimer = null;
    }

    private async enqueueFlush(): Promise<void> {
        if (this.buffer.length === 0) {
            await this.flushQueue;
            return;
        }

        const segments = this.buffer;
        this.buffer = [];
        this.bufferedBytes = 0;

        this.flushQueue = this.flushQueue
            .catch(() => undefined)
            .then(async () => {
                try {
                    await this.flushSegments(segments);
                } catch (error: unknown) {
                    logger.warn(
                        {
                            err: error,
                            segmentCount: segments.length
                        },
                        'Failed to flush buffered execution logs'
                    );
                }
            });

        await this.flushQueue;
    }
}

const normalizeTimesteps = (timesteps: number[]): number[] => {
    return Array.from(new Set(
        timesteps.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    ));
};

export const createAnalysisExecutionLogSink = (
    options: AnalysisExecutionLogSinkOptions
): ProcessExecutionLogSink => {
    const timesteps = normalizeTimesteps(options.timesteps);

    return new BufferedExecutionLogSink({
        metadata: options.metadata,
        flushIntervalMs: options.flushIntervalMs,
        maxBufferedBytes: options.maxBufferedBytes,
        flushSegments: async (segments) => {
            if (!timesteps.length || segments.length === 0) {
                return;
            }

            await Promise.all(timesteps.map((timestep) => options.reporter.reportAnalysisLogChunk({
                jobId: options.jobId,
                analysisId: options.analysisId,
                teamId: options.teamId,
                trajectoryId: options.trajectoryId,
                timestep,
                segments
            })));
        }
    });
};

export const createDebugExecutionLogSink = (
    options: DebugExecutionLogSinkOptions
): ProcessExecutionLogSink => {
    return new BufferedExecutionLogSink({
        metadata: options.metadata,
        flushIntervalMs: options.flushIntervalMs,
        maxBufferedBytes: options.maxBufferedBytes,
        flushSegments: async (segments) => {
            if (segments.length === 0) {
                return;
            }

            await options.reporter.reportDebugLogChunk({
                sessionId: options.sessionId,
                nodeId: options.nodeId,
                segments
            });
        }
    });
};
