import { logger } from '@/core/logger';
import type {
    ExecutionLogSegment,
    ExecutionLogSegmentMetadata,
    ProcessExecutionLogChunk,
    ProcessExecutionLogSink
} from '@/core/runtime/contracts/execution-log';

interface AnalysisExecutionLogReporter {
    reportAnalysisLogChunk(input: AnalysisExecutionLogChunkReport): Promise<void>;
}

interface DebugExecutionLogReporter {
    reportDebugLogChunk(input: DebugExecutionLogChunkReport): Promise<void>;
}

interface AnalysisExecutionLogChunkReport {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    segments: ExecutionLogSegment[];
}

interface DebugExecutionLogChunkReport {
    sessionId: string;
    nodeId: string;
    segments: ExecutionLogSegment[];
}

interface BufferedExecutionLogSinkOptions {
    flushSegments: (segments: ExecutionLogSegment[]) => Promise<void>;
    metadata?: ExecutionLogSegmentMetadata;
    flushIntervalMs?: number;
    maxBufferedBytes?: number;
}

interface AnalysisExecutionLogSinkOptions {
    reporter: AnalysisExecutionLogReporter;
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
    reporter: DebugExecutionLogReporter;
    sessionId: string;
    nodeId: string;
    metadata?: ExecutionLogSegmentMetadata;
    flushIntervalMs?: number;
    maxBufferedBytes?: number;
}

const DEFAULT_FLUSH_INTERVAL_MS = 250;
const DEFAULT_MAX_BUFFERED_BYTES = 8 * 1024;

const createBufferedExecutionLogSink = (
    options: BufferedExecutionLogSinkOptions
): ProcessExecutionLogSink => {
    const flushSegments = options.flushSegments;
    const metadata = options.metadata;
    const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    const maxBufferedBytes = options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
    let buffer: ExecutionLogSegment[] = [];
    let bufferedBytes = 0;
    let flushTimer: NodeJS.Timeout | null = null;
    let flushQueue: Promise<void> = Promise.resolve();

    const enqueueFlush = async (): Promise<void> => {
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }

        if (buffer.length === 0) {
            await flushQueue;
            return;
        }

        const segments = buffer;
        buffer = [];
        bufferedBytes = 0;

        flushQueue = flushQueue
            .catch(() => undefined)
            .then(() => flushSegments(segments))
            .catch((err) => logger.warn({ err }, 'Failed to flush buffered execution logs'));

        await flushQueue;
    };

    return {
        handleChunk(chunk: ProcessExecutionLogChunk): void {
            if (!chunk.text) return;

            const segment: ExecutionLogSegment = {
                stream: chunk.stream,
                text: chunk.text,
                occurredAt: chunk.occurredAt,
                nodeId: metadata?.nodeId,
                nodeType: metadata?.nodeType,
                nodeLabel: metadata?.nodeLabel,
                pluginId: metadata?.pluginId,
                executionPath: metadata?.executionPath ? [...metadata.executionPath] : undefined
            };

            buffer.push(segment);
            bufferedBytes += Buffer.byteLength(segment.text, 'utf8');

            if (bufferedBytes >= maxBufferedBytes) {
                enqueueFlush();
                return;
            }

            if (flushTimer) {
                return;
            }

            flushTimer = setTimeout(() => {
                flushTimer = null;
                enqueueFlush();
            }, flushIntervalMs);

            flushTimer.unref?.();
        },
        flush: enqueueFlush
    };
};

export const createAnalysisExecutionLogSink = (
    options: AnalysisExecutionLogSinkOptions
): ProcessExecutionLogSink => {
    const timesteps = [...new Set(options.timesteps)];

    return createBufferedExecutionLogSink({
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
    const { reporter, sessionId, nodeId, metadata, flushIntervalMs, maxBufferedBytes } = options;

    return createBufferedExecutionLogSink({
        metadata,
        flushIntervalMs,
        maxBufferedBytes,
        flushSegments: async (segments) => {
            await reporter.reportDebugLogChunk({
                sessionId,
                nodeId,
                segments
            });
        }
    });
};
