export type JobLifecycleStatus = 'started' | 'completed' | 'failed';

export interface JobLifecycleCleanupContext {
    reachedTerminal: boolean;
    error: Error | null;
}

export interface JobLifecycleHandlers {
    reportStatus: (status: JobLifecycleStatus, error?: string) => void;
    progress?: (value: number) => Promise<void>;
    cleanup?: (context: JobLifecycleCleanupContext) => Promise<void> | void;
    /**
     * Optional predicate that decides whether the terminal `failed` event should
     * be reported when `operation` throws. Useful for BullMQ workers that only
     * want to publish `failed` on the final retry attempt, or that want to
     * suppress reporting for control-flow errors like `DelayedError`.
     */
    shouldReportTerminal?: (error: Error) => boolean;
}

/**
 * Wraps a job operation with the canonical try/catch/finally lifecycle:
 *   reportStatus('started') → progress(10) → operation() → progress(100) → reportStatus('completed')
 *   catch: reportStatus('failed', error.message); rethrow
 *   finally: cleanup({ reachedTerminal, error })
 *
 * `reportStatus` is invoked synchronously (fire-and-forget) to match the
 * existing worker semantics where reporter errors are logged by the reporter
 * implementation itself and never block the job pipeline.
 */
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
            await handlers.cleanup({ reachedTerminal, error: caughtError });
        }
    }
};
