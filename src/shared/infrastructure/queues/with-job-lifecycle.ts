export type JobLifecycleStatus = 'started' | 'completed' | 'failed';

export interface JobLifecycleCleanupContext {
    reachedTerminal: boolean;
    error: Error | null;
}

export interface JobLifecycleHandlers {
    reportStatus: (status: JobLifecycleStatus, error?: string) => void;
    progress?: (value: number) => Promise<void>;
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
        await handlers.progress?.(10);

        const result = await operation();

        await handlers.progress?.(100);
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

export const isFinalAttempt = (bullJob: { attemptsMade: number; opts: { attempts?: number } }): boolean =>
    bullJob.attemptsMade + 1 >= (bullJob.opts.attempts ?? 1);
