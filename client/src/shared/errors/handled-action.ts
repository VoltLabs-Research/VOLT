import { getAccessDeniedMessage, getApiErrorMessage, isAccessDeniedError, notifyApiError } from '@/shared/errors/notify-api-error';
import { runAction } from '@/shared/presentation/actions/run-action';
import { sileo } from 'sileo';
import type { RunActionOptions } from '@/shared/presentation/actions/run-action';

interface ErrorToastOptions {
    title: string;
    description?: string;
}

interface HandleActionErrorOptions {
    accessDeniedTitle?: string;
    notifyAccessDenied?: boolean;
    onAccessDenied?: (message: string) => void;
    fallbackErrorMessage?: string;
    onError?: (message: string) => void;
    errorToast?: ErrorToastOptions | false;
}

export interface RunHandledActionOptions<T> extends RunActionOptions<T>, HandleActionErrorOptions {
    rethrow?: boolean;
}

const DEFAULT_ACCESS_DENIED_TITLE = 'You do not have permission to perform this action.';

export const handleActionError = (
    error: unknown,
    {
        accessDeniedTitle = DEFAULT_ACCESS_DENIED_TITLE,
        notifyAccessDenied = true,
        onAccessDenied,
        fallbackErrorMessage,
        onError,
        errorToast
    }: HandleActionErrorOptions = {}
) => {
    if (isAccessDeniedError(error)) {
        const message = getAccessDeniedMessage(error, accessDeniedTitle) ?? accessDeniedTitle;

        if (notifyAccessDenied) {
            notifyApiError(error, { fallbackTitle: accessDeniedTitle });
        }

        onAccessDenied?.(message);
        return;
    }

    const fallbackMessage = fallbackErrorMessage ?? (errorToast === false ? undefined : errorToast?.title) ?? 'Something went wrong';
    const message = getApiErrorMessage(error, fallbackMessage);

    onError?.(message);

    if (errorToast !== false) {
        sileo.error(errorToast ?? { title: fallbackMessage });
    }
};

export const runHandledAction = async <T,>(
    options: RunHandledActionOptions<T>
): Promise<T | null | undefined> => {
    try {
        return await runAction(options);
    } catch (error: unknown) {
        handleActionError(error, {
            accessDeniedTitle: options.accessDeniedTitle,
            notifyAccessDenied: options.notifyAccessDenied,
            onAccessDenied: options.onAccessDenied,
            fallbackErrorMessage: options.fallbackErrorMessage,
            onError: options.onError,
            errorToast: options.toast ? false : options.errorToast
        });

        if (options.rethrow ?? true) {
            throw error;
        }

        return undefined;
    }
};
