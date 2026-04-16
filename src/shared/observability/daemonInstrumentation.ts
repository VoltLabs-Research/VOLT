import { logger } from '@/core/logger';
import { isRecord } from '@/shared/utilities/type-guards';

export interface DaemonTraceContext {
    correlationId?: string;
    parentSpanId?: string;
    requestId?: string;
    source?: string;
    spanId?: string;
    traceId?: string;
};

interface TimeoutExecutionOptions {
    onTimeout?: () => void | Promise<void>;
    operation: string;
    timeoutMs: number;
    payload?: Record<string, unknown>;
    traceContext?: DaemonTraceContext;
};

interface TraceSourceRecord extends Record<string, unknown> {
    correlationId?: unknown;
    parentSpanId?: unknown;
    requestId?: unknown;
    source?: unknown;
    spanId?: unknown;
    traceId?: unknown;
};

const readTraceValue = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const mergeTraceContext = (current: DaemonTraceContext, source: TraceSourceRecord): DaemonTraceContext => {
    return {
        correlationId: current.correlationId ?? readTraceValue(source.correlationId),
        parentSpanId: current.parentSpanId ?? readTraceValue(source.parentSpanId),
        requestId: current.requestId ?? readTraceValue(source.requestId),
        source: current.source ?? readTraceValue(source.source),
        spanId: current.spanId ?? readTraceValue(source.spanId),
        traceId: current.traceId ?? readTraceValue(source.traceId)
    };
};

export const extractDaemonTraceContext = (payload?: Record<string, unknown>): DaemonTraceContext | undefined => {
    if (!payload) {
        return undefined;
    }

    const nestedMetadata = isRecord(payload.metadata) ? payload.metadata : undefined;
    const traceSources: TraceSourceRecord[] = [payload];

    if (isRecord(payload.traceContext)) {
        traceSources.push(payload.traceContext);
    }

    if (isRecord(payload.trace)) {
        traceSources.push(payload.trace);
    }

    if (nestedMetadata) {
        traceSources.push(nestedMetadata);
        if (isRecord(nestedMetadata.traceContext)) {
            traceSources.push(nestedMetadata.traceContext);
        }
        if (isRecord(nestedMetadata.trace)) {
            traceSources.push(nestedMetadata.trace);
        }
    }

    const traceContext = traceSources.reduce<DaemonTraceContext>((current, source) => {
        return mergeTraceContext(current, source);
    }, {});

    return Object.values(traceContext).some((value) => typeof value === 'string') ? traceContext : undefined;
};

export const serializeDaemonTraceContext = (
    traceContext?: DaemonTraceContext
): Record<string, string> | undefined => {
    if (!traceContext) {
        return undefined;
    }

    const serializedTraceContextEntries = Object.entries(traceContext)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);

    if (serializedTraceContextEntries.length === 0) {
        return undefined;
    }

    return Object.fromEntries(serializedTraceContextEntries);
};

export const createTraceLogContext = (traceContext?: DaemonTraceContext): Record<string, string> => {
    return serializeDaemonTraceContext(traceContext) ?? {};
};

export const withTimeout = async <T>(
    execute: () => Promise<T>,
    options: TimeoutExecutionOptions
): Promise<T> => {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            logger.warn(
                {
                    operation: options.operation,
                    timeoutMs: options.timeoutMs,
                    ...options.payload,
                    ...createTraceLogContext(options.traceContext)
                },
                'Operation timed out'
            );
            Promise.resolve(options.onTimeout?.())
                .catch((error: unknown) => {
                    logger.warn({ err: error, operation: options.operation }, 'Timeout cleanup failed');
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
