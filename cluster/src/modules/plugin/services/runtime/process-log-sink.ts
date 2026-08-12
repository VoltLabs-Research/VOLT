import { logger } from '@shared/infrastructure/logger';
import type {
    ProcessExecutionLogSink,
    ProcessExecutionLogStream
} from '@shared/contracts/types/execution-log';


export const forwardLogChunk = (
    logSink: ProcessExecutionLogSink | undefined,
    stream: ProcessExecutionLogStream,
    text: string,
    context?: Record<string, unknown>
): void => {
    if (!logSink || text.length === 0) return;

    Promise.resolve(logSink.handleChunk({
        stream,
        text,
        occurredAt: new Date().toISOString()
    })).catch((error: unknown) => {
        logger.warn({
            err: error,
            ...context
        }, '@process-log-sink: failed to forward log chunk');
    });
};

export const flushLogSink = async (logSink: ProcessExecutionLogSink | undefined): Promise<void> => {
    if (!logSink?.flush) return;

    try {
        await logSink.flush();
    } catch (error: unknown) {
        logger.warn({ err: error }, '@process-log-sink: failed to flush log sink');
    }
};
