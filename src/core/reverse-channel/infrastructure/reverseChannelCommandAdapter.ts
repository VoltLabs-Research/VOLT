import { createTraceLogContext, extractDaemonTraceContext } from '@/core/observability/infrastructure/daemonInstrumentation';
import { logger } from '@/core/logger';
import { CommandError } from '@/core/commands/CommandError';
import type {
    ReverseChannelCommandExecutor,
    ReverseChannelCommandPayload,
    ReverseChannelCommandResult,
    ReverseChannelCommandPayloadView
} from '@/core/reverse-channel/contracts/commandHandler';
import { EmptyFilterResultError } from '@/modules/trajectory/domain/services/FilterEvaluatorService';

interface CommandResult extends ReverseChannelCommandResult {}

interface HandlerContext {
    command: string;
    requestId: string;
}

interface ReverseChannelHandler {
    handle(
        payload: ReverseChannelCommandPayload | undefined,
        context: HandlerContext
    ): Promise<CommandResult> | CommandResult;
}

/** Adapts daemon command handlers to the SDK bridge contract with shared logging. */
export const adaptReverseChannelHandler = (
    commandName: string,
    execute: ReverseChannelCommandExecutor
): ReverseChannelHandler => {
    return {
        handle: async (payload, ctx): Promise<CommandResult> => {
            const commandPayload = payload as ReverseChannelCommandPayload | undefined;
            const commandPayloadView = payload as ReverseChannelCommandPayloadView | undefined;
            const handlerContext = ctx as HandlerContext | undefined;
            const requestId = handlerContext?.requestId ?? commandPayloadView?.requestId;
            const commandLogContext = {
                ...(requestId ? { requestId } : {}),
                ...createTraceLogContext(extractDaemonTraceContext(commandPayloadView))
            };

            try {
                const result = await execute(commandPayload);
                return {
                    status: result.status,
                    data: result.data,
                    body: result.body,
                    headers: result.headers,
                    stream: result.stream
                };
            } catch (error) {
                if (error instanceof EmptyFilterResultError) {
                    logger.warn(
                        {
                            command: commandName,
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

                if (error instanceof CommandError) {
                    logger.warn(
                        {
                            command: commandName,
                            code: error.code,
                            message: error.message,
                            ...commandLogContext
                        },
                        'Daemon command rejected'
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
