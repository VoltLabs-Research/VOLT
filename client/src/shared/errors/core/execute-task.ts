import { reportError } from '@/shared/errors/core/report-error';
import type { ExecuteTaskOptions } from '@/shared/errors/core/types';

/**
 * Executes an async action with centralized error handling.
 *
 * On success, calls `onSuccess` and returns the result.
 * On failure, reports the error through the core error pipeline and
 * returns `undefined` (unless `rethrow` is true).
 *
 * @param options - The action to execute along with error handling configuration.
 * @returns The action result, or `undefined` if the action failed and `rethrow` is false.
 */
export const executeTask = async <T>(
    options: ExecuteTaskOptions<T>
): Promise<T | undefined> => {
    const { action, onSuccess, rethrow = false, ...reportOptions } = options;

    try {
        const result = typeof action === 'function' ? await action() : await action;
        await onSuccess?.(result);
        return result;
    } catch (error: unknown) {
        reportError(error, reportOptions);

        if (rethrow) {
            throw error;
        }

        return undefined;
    }
};
