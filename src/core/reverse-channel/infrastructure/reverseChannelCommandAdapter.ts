import { createTraceLogContext, extractDaemonTraceContext } from '@/core/observability/infrastructure/daemonInstrumentation';
import { logger } from '@/core/logger';
import type { ReverseChannelCommandHandler, ReverseChannelCommandResult } from '@/core/reverse-channel/contracts/commandHandler';
import type { CommandResult, ReverseChannelHandler } from '@voltstack/daemon-cluster-client';

interface ReverseChannelHandlerContext extends Record<string, unknown> {
    requestId?: unknown;
};

interface StatusCodeError {
    code?: unknown;
    message: string;
    statusCode: number;
}

const isStatusCodeError = (error: unknown): error is StatusCodeError => {
    return typeof error === 'object'
        && error !== null
        && typeof (error as { message?: unknown }).message === 'string'
        && typeof (error as { statusCode?: unknown }).statusCode === 'number';
};

const isEmptyFilterResultError = (error: unknown): error is { code: string; message: string } => {
    return typeof error === 'object'
        && error !== null
        && (error as { code?: unknown }).code === 'EMPTY_FILTER_RESULT'
        && typeof (error as { message?: unknown }).message === 'string';
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

/** Adapts daemon command handlers to the SDK bridge contract with shared logging. */
export const adaptReverseChannelHandler = (handler: ReverseChannelCommandHandler): ReverseChannelHandler => {
    return {
        handle: async (payload, ctx): Promise<CommandResult> => {
            const commandPayload = payload as Record<string, unknown> | undefined;
            const handlerContext = ctx as unknown as ReverseChannelHandlerContext | undefined;
            const requestId = readRequestId(handlerContext, commandPayload);
            const commandLogContext = {
                ...(requestId ? { requestId } : {}),
                ...createTraceLogContext(extractDaemonTraceContext(commandPayload))
            };

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
                if (isEmptyFilterResultError(error)) {
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

                if (isStatusCodeError(error)) {
                    logger.warn(
                        {
                            command: handler.command,
                            code: typeof error.code === 'string' ? error.code : 'DAEMON_COMMAND_REJECTED',
                            message: error.message,
                            ...commandLogContext
                        },
                        'Daemon command rejected'
                    );
                    return {
                        status: error.statusCode,
                        data: {
                            status: 'error',
                            code: typeof error.code === 'string' ? error.code : 'DAEMON_COMMAND_REJECTED',
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
