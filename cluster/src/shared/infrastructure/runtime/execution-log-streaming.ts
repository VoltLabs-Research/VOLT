import { logger } from '@shared/infrastructure/logger';
import type {
    ExecutionLogSegment,
    ExecutionLogSegmentMetadata,
    ProcessExecutionLogChunk,
    ProcessExecutionLogSink
} from '@shared/contracts/types/execution-log';

interface AnalysisExecutionLogReporter {
    reportAnalysisLogChunk(input: AnalysisExecutionLogChunkReport): Promise<void>;
}

interface AnalysisExecutionLogChunkReport {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
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

const DEFAULT_FLUSH_INTERVAL_MS = 250;
const DEFAULT_MAX_BUFFERED_BYTES = 8 * 1024;
const MAX_CONSECUTIVE_FLUSH_FAILURES = 3;

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
    let consecutiveFlushFailures = 0;

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

        flushQueue = flushQueue.then(async () => {
            try {
                await flushSegments(segments);
                consecutiveFlushFailures = 0;
            } catch (error) {
                consecutiveFlushFailures += 1;
                if (consecutiveFlushFailures >= MAX_CONSECUTIVE_FLUSH_FAILURES) {
                    consecutiveFlushFailures = 0;
                    logger.error({
                        err: error,
                        droppedSegments: segments.length
                    }, 'Dropping execution log segments after repeated flush failures');
                    return;
                }
                logger.warn({
                    err: error,
                    attempt: consecutiveFlushFailures
                }, 'Failed to flush execution logs; requeueing segments');
                buffer = [...segments, ...buffer];
                bufferedBytes += segments.reduce((sum, segment) => sum + Buffer.byteLength(segment.text, 'utf8'), 0);
                if (!flushTimer) {
                    flushTimer = setTimeout(() => {
                        flushTimer = null;
                        enqueueFlush();
                    }, flushIntervalMs);
                    flushTimer.unref();
                }
            }
        });

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

            flushTimer.unref();
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
