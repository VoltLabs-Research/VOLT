import { logger } from '@shared/logger';
import type { ProcessExecutionLogSink, ProcessExecutionLogStream } from '@shared/contracts/types/execution-log';
import type { PluginProgressDirective } from '@volt/contracts/modules/plugin/progress';
import { PluginStderrDemuxer } from '@modules/plugin/services/runtime/plugin-stderr-demuxer';


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

export const forwardProgress = (
    logSink: ProcessExecutionLogSink | undefined,
    directive: PluginProgressDirective,
    context?: Record<string, unknown>
): void => {
    if (!logSink?.handleProgress) return;

    try {
        logSink.handleProgress(directive);
    } catch (error: unknown) {
        logger.warn({
            err: error,
            ...context
        }, '@process-log-sink: failed to forward plugin progress');
    }
};

// A plugin's stderr: its text to the log sink the caller resolves, its @volt: lines as progress.
export const createStderrDemuxer = (
    resolveLogSink: () => ProcessExecutionLogSink | undefined,
    onText?: (text: string) => void,
    context?: Record<string, unknown>
): PluginStderrDemuxer => new PluginStderrDemuxer({
    onText: (text) => {
        onText?.(text);
        forwardLogChunk(resolveLogSink(), 'stderr', text, context);
    },
    onDirective: (directive) => forwardProgress(resolveLogSink(), directive, context)
});

export const flushLogSink = async (logSink: ProcessExecutionLogSink | undefined): Promise<void> => {
    if (!logSink?.flush) return;

    try {
        await logSink.flush();
    } catch (error: unknown) {
        logger.warn({ err: error }, '@process-log-sink: failed to flush log sink');
    }
};
