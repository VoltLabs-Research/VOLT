import { logger } from '@/core/logger';

interface TimeoutExecutionOptions {
    onTimeout?: () => void | Promise<void>;
    operation: string;
    timeoutMs: number;
    payload?: Record<string, string | number | boolean | null | undefined>;
    traceContext?: DaemonTraceContext;
}
interface DaemonTracePayload extends DaemonTraceContext {
    metadata?: DaemonTracePayload;
    traceContext?: DaemonTracePayload;
    trace?: DaemonTracePayload;
}

export interface DaemonTraceContext {
    correlationId?: string;
    parentSpanId?: string;
    requestId?: string;
    source?: string;
    spanId?: string;
    traceId?: string;
}

export const extractDaemonTraceContext = (payload?: DaemonTracePayload): DaemonTraceContext | undefined => {
    if (!payload) {
        return undefined;
    }

    const traceSources = [
        payload,
        payload.traceContext,
        payload.trace,
        payload.metadata,
        payload.metadata?.traceContext,
        payload.metadata?.trace
    ];

    const traceContext: DaemonTraceContext = {};

    for (const source of traceSources) {
        if (!source) {
            continue;
        }

        traceContext.correlationId ??= source.correlationId;
        traceContext.parentSpanId ??= source.parentSpanId;
        traceContext.requestId ??= source.requestId;
        traceContext.source ??= source.source;
        traceContext.spanId ??= source.spanId;
        traceContext.traceId ??= source.traceId;
    }

    return Object.values(traceContext).some((value) => typeof value === 'string') ? traceContext : undefined;
};

export const serializeDaemonTraceContext = (
    traceContext?: DaemonTraceContext
): Record<string, string> | undefined => {
    if (!traceContext) {
        return undefined;
    }

    const serializedTraceContext = createTraceLogContext(traceContext);

    if (Object.keys(serializedTraceContext).length === 0) {
        return undefined;
    }

    return serializedTraceContext;
};

export const createTraceLogContext = (traceContext?: DaemonTraceContext): Record<string, string> => {
    if (!traceContext) {
        return {};
    }

    const serializedTraceContext: Record<string, string> = {};

    for (const [key, value] of Object.entries(traceContext)) {
        if (value) {
            serializedTraceContext[key] = value;
        }
    }

    return serializedTraceContext;
};

export const withTimeout = async <T>(
    execute: () => Promise<T>,
    options: TimeoutExecutionOptions
): Promise<T> => {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            logger.warn('Operation timed out');
            const onTimeout = options.onTimeout;
            const cleanup = onTimeout ? onTimeout() : undefined;

            Promise.resolve(cleanup)
                .catch((error) => {
                    logger.warn(`Timeout cleanup failed for operation=${options.operation}: ${error instanceof Error ? error.message : String(error)}`);
                })
                .finally(() => {
                    reject(new Error(`${options.operation} timed out after ${options.timeoutMs}ms`));
                });
        }, options.timeoutMs);

        if (timeoutId.unref) {
            timeoutId.unref();
        }
    });

    try {
        return await Promise.race([execute(), timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};
