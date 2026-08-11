import { closeModal } from '@/shared/ui/modal';
import { confirmAction } from '@/shared/ui/hooks/use-confirm';
import { isAbortError, reportError } from '@/shared/errors/core';
import { showPromise } from '@/shared/ui/hooks/toast';
import type { ConfirmActionOptions } from '@/shared/ui/hooks/use-confirm';
import type { PromiseToastOptions } from '@/shared/ui/utils/toast-options';

type ActionSource<T> = Promise<T> | (() => Promise<T>);

interface RunActionOptions<T> {
    action: ActionSource<T>;
    confirm?: string | ConfirmActionOptions;
    toast?: PromiseToastOptions<T>;
    modalId?: string;
    afterSuccess?: (result: T) => void | Promise<void>;
}

const resolveAction = <T,>(action: ActionSource<T>): Promise<T> => {
    return typeof action === 'function' ? action() : action;
};

/**
 * Runs a user-initiated action, reporting any failure to the user and returning
 * `null` instead of rejecting.
 *
 * `null` already means "the action did not happen" (a declined confirmation), so
 * a failure resolves to the same value. Callers that need to know whether the
 * action succeeded check the result; they must not have to wrap every call in an
 * empty `catch` to avoid an unhandled rejection they cannot act on.
 */
export const runAction = async <T,>({
    action,
    confirm,
    toast,
    modalId,
    afterSuccess
}: RunActionOptions<T>): Promise<T | null> => {
    if (confirm && !(await confirmAction(confirm))) {
        return null;
    }

    let result: T;
    try {
        result = toast
            ? await showPromise(resolveAction(action), toast)
            : await resolveAction(action);
    } catch (error) {
        // A cancellation is not a failure, and `showPromise` has already
        // reported anything it toasted; `reportError` no-ops on handled errors.
        if (!isAbortError(error)) {
            reportError(error);
        }
        return null;
    }

    await afterSuccess?.(result);

    if (modalId) {
        closeModal(modalId);
    }

    return result;
};
