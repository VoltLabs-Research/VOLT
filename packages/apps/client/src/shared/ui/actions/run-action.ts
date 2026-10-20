import { closeModal } from '@/shared/ui/modal/use-modal-store';
import { confirmAction } from '@/shared/ui/hooks/use-confirm';
import { isAbortError, reportError } from '@/shared/errors/core/report-error';
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
