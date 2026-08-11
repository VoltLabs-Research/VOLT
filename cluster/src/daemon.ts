import { getDaemonLifecycle } from '@core/bootstrap/DaemonLifecycle';
import { logger } from '@shared/infrastructure/logger';

let shutdownPromise: Promise<void> | null = null;

const shutdown = (): void => {
    shutdownPromise ??= getDaemonLifecycle().stop();

    shutdownPromise
        .then(() => process.exit(0))
        .catch((error: unknown) => {
            logger.error(`@daemon: shutdown error: ${error instanceof Error ? error.stack || error.message : String(error)}`);
            process.exit(1);
        });
};

process.on('unhandledRejection', (reason: unknown) => {
    logger.error(`@daemon: unhandled rejection: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
});

process.on('uncaughtException', (error: Error) => {
    logger.error(`@daemon: uncaught exception: ${error.stack || error.message}`);
    process.exit(1);
});

const startDaemon = async (): Promise<void> => {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await getDaemonLifecycle().start();
};

startDaemon().catch((error: unknown) => {
    logger.error(`@daemon: startup error: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    process.exit(1);
});
