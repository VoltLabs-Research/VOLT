import { createTraceLogContext, extractDaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import { logger } from '@/core/logger';
import { CommandError } from '@/core/commands/CommandError';
import type {
    ReverseChannelCommandExecutor,
    ReverseChannelCommandPayload,
    ReverseChannelCommandResult,
    ReverseChannelCommandPayloadView
} from '@/core/reverse-channel/contracts/command-handler';
import { EmptyFilterResultError } from '@/modules/trajectory/domain/services/FilterEvaluator';

/** Adapts daemon command handlers to the SDK bridge contract with shared logging. */
export const adaptReverseChannelHandler = (
    commandName: string,
    execute: ReverseChannelCommandExecutor
): {
    handle(
        payload: ReverseChannelCommandPayload | undefined,
        ctx?: { requestId?: string }
    ): Promise<ReverseChannelCommandResult>;
} => {
    return {
        handle: async (payload, ctx): Promise<ReverseChannelCommandResult> => {
            const commandPayloadView = payload as ReverseChannelCommandPayloadView | undefined;
            const requestId = ctx?.requestId ?? commandPayloadView?.requestId;
            const commandLogContext = {
                requestId,
                ...createTraceLogContext(extractDaemonTraceContext(commandPayloadView))
            };

            try {
                const result = await execute(payload);
                return {
                    status: result.status,
                    data: result.data,
                    body: result.body,
                    headers: result.headers,
                    stream: result.stream
                };
            } catch (error) {
                if (error instanceof EmptyFilterResultError) {
                    logger.warn('Daemon command rejected: empty filter result');
                    return {
                        status: 422,
                        data: {
                            status: 'error',
                            code: error.code,
                            message: error.message
                        }
                    };
                }

                if (error instanceof CommandError) {
                    logger.warn('Daemon command rejected');
                    return {
                        status: error.statusCode,
                        data: {
                            status: 'error',
                            code: error.code,
                            message: error.message
                        }
                    };
                }

                const unhandledError = error instanceof Error
                    ? error
                    : new Error('An unexpected error occurred');
                logger.error(
                    {
                        command: commandName,
                        code: 'INTERNAL_ERROR',
                        message: unhandledError.message,
                        stack: unhandledError.stack,
                        ...commandLogContext
                    },
                    'Daemon command failed with unhandled exception'
                );
                return {
                    status: 500,
                    data: {
                        status: 'error',
                        code: 'INTERNAL_ERROR',
                        message: unhandledError.message
                    }
                };
            }
        }
    };
};
