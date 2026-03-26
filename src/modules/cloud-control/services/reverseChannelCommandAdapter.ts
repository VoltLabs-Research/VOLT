import { EmptyFilterResultError } from '@/modules/trajectory-native/services';
import { createTraceLogContext, extractDaemonTraceContext } from '@/shared/observability/daemonInstrumentation';
import { logger } from '@/core/logger';
import { DaemonCommandError } from './DaemonCommandError';
import { RuntimeCapabilityError } from './RuntimeCapabilityGuard';
import type { TeamClusterDaemonSocketHeaders } from '@/shared/contracts';
import type { CommandResult, ReverseChannelHandler } from '@voltstack/daemon-cluster-client';

export interface ReverseChannelCommandHandler {
    command: string;
    execute: (payload: Record<string, unknown> | undefined) => Promise<ReverseChannelCommandResult>;
};

export interface ReverseChannelCommandResult {
    status?: number;
    data?: unknown;
    body?: Buffer;
    headers?: TeamClusterDaemonSocketHeaders;
    stream?: ReadableStream<Uint8Array>;
};

interface ReverseChannelHandlerContext extends Record<string, unknown> {
    requestId?: unknown;
};

const isReverseChannelHandlerContext = (value: unknown): value is ReverseChannelHandlerContext => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isCommandPayloadRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readRequestId = (
    ctx: ReverseChannelHandlerContext | undefined,
    payload: Record<string, unknown> | undefined
): string | undefined => {
    if (typeof ctx?.requestId === 'string' && ctx.requestId.trim().length > 0) {
        return ctx.requestId.trim();
    }

    if (typeof payload?.requestId === 'string' && payload.requestId.trim().length > 0) {
        return payload.requestId.trim();
    }

    return undefined;
};

export const createCommandLogContext = (
    payload: Record<string, unknown> | undefined,
    ctx: unknown
): Record<string, string> => {
    const handlerContext = isReverseChannelHandlerContext(ctx) ? ctx : undefined;
    const requestId = readRequestId(handlerContext, payload);

    return {
        ...(requestId ? { requestId } : {}),
        ...createTraceLogContext(extractDaemonTraceContext(payload))
    };
};

/** Adapts daemon command handlers to the SDK bridge contract with shared logging. */
export const adaptReverseChannelHandler = (handler: ReverseChannelCommandHandler): ReverseChannelHandler => {
    return {
        handle: async (payload, ctx): Promise<CommandResult> => {
            const commandPayload = isCommandPayloadRecord(payload) ? payload : undefined;
            const commandLogContext = createCommandLogContext(commandPayload, ctx);

            try {
                const result = await handler.execute(commandPayload);
                return {
                    status: result.status,
                    data: result.data,
                    body: result.body,
                    headers: result.headers,
                    stream: result.stream
                };
            } catch (error: unknown) {
                if (error instanceof EmptyFilterResultError) {
                    logger.warn(
                        {
                            command: handler.command,
                            code: error.code,
                            message: error.message,
                            ...commandLogContext
                        },
                        'Daemon command rejected: empty filter result'
                    );
                    return {
                        status: 422,
                        data: {
                            status: 'error',
                            code: error.code,
                            message: error.message
                        }
                    };
                }

                if (error instanceof RuntimeCapabilityError) {
                    logger.warn(
                        {
                            command: handler.command,
                            code: error.code,
                            message: error.message,
                            ...commandLogContext
                        },
                        'Daemon command rejected by runtime capability guard'
                    );
                    return {
                        status: error.statusCode,
                        data: {
                            status: 'error',
                            code: error.code,
                            message: error.message
                        }
                    };
                }

                if (error instanceof DaemonCommandError) {
                    logger.warn(
                        {
                            command: handler.command,
                            code: error.code,
                            message: error.message,
                            ...commandLogContext
                        },
                        'Daemon command rejected by validation'
                    );
                    return {
                        status: error.statusCode,
                        data: {
                            status: 'error',
                            code: error.code,
                            message: error.message
                        }
                    };
                }

                const message = error instanceof Error ? error.message : 'An unexpected error occurred';
                const stack = error instanceof Error ? error.stack : undefined;
                logger.error(
                    {
                        command: handler.command,
                        code: 'INTERNAL_ERROR',
                        message,
                        stack,
                        ...commandLogContext
                    },
                    'Daemon command failed with unhandled exception'
                );
                return {
                    status: 500,
                    data: {
                        status: 'error',
                        code: 'INTERNAL_ERROR',
                        message
                    }
                };
            }
        }
    };
};
