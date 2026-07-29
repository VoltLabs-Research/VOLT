import { closeModal } from '@voltstack/bravais';
import { confirmAction } from '@/shared/ui/hooks/use-confirm';
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

    const result = toast
        ? await showPromise(resolveAction(action), toast)
        : await resolveAction(action);

    await afterSuccess?.(result);

    if (modalId) {
        closeModal(modalId);
    }

    return result;
};
