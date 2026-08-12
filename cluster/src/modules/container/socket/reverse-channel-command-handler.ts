import { createTraceLogContext, extractDaemonTraceContext } from '@shared/infrastructure/observability/daemon-instrumentation';
import { logger } from '@shared/infrastructure/logger';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ReverseChannelCommandExecutor, ReverseChannelCommandPayloadView } from '@shared/contracts/channel/reverse-channel-messaging';
import type { ReverseChannelHandler } from '@voltstack/daemon-cluster-client';

export const createReverseChannelCommandHandler = (
    commandName: string,
    execute: ReverseChannelCommandExecutor
): ReverseChannelHandler => ({
    handle: async (payload, ctx) => {
        try {
            return await execute(payload as object | undefined);
        } catch (error) {
            if (error instanceof ApplicationError) {
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

            const commandPayloadView = payload as ReverseChannelCommandPayloadView | undefined;
            const unhandledError = error instanceof Error
                ? error
                : new Error('An unexpected error occurred');
            logger.error(
                {
                    command: commandName,
                    code: 'INTERNAL_ERROR',
                    message: unhandledError.message,
                    stack: unhandledError.stack,
                    requestId: ctx?.requestId ?? commandPayloadView?.requestId,
                    ...createTraceLogContext(extractDaemonTraceContext(commandPayloadView))
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
});
