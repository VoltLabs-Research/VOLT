import type { QueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';

export type JobLifecycleStatus = 'started' | 'completed' | 'failed';

export interface JobLifecycleCleanupContext {
    reachedTerminal: boolean;
    error: Error | null;
}

export interface JobLifecycleHandlers {
    reportStatus: (status: JobLifecycleStatus, error?: string) => void;
    cleanup?: (context: JobLifecycleCleanupContext) => Promise<void> | void;

    shouldReportTerminal?: (error: Error) => boolean;
}

export const withJobLifecycle = async <T>(
    handlers: JobLifecycleHandlers,
    operation: () => Promise<T>
): Promise<T> => {
    let reachedTerminal = false;
    let caughtError: Error | null = null;

    try {
        handlers.reportStatus('started');

        const result = await operation();

        handlers.reportStatus('completed');
        reachedTerminal = true;

        return result;
    } catch (error) {
        if (!(error instanceof Error)) {
            throw error;
        }

        caughtError = error;
        if (handlers.shouldReportTerminal?.(error) ?? true) {
            handlers.reportStatus('failed', error.message);
            reachedTerminal = true;
        }

        throw error;
    } finally {
        if (handlers.cleanup) {
            await handlers.cleanup({
                reachedTerminal,
                error: caughtError
            });
        }
    }
};

export const isFinalAttempt = (job: QueueJobHandle<unknown>): boolean =>
    job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
