import { getErrorMessage, isApiError, markApiErrorHandled } from '@/shared/errors/core';
import { sileo } from 'sileo';
import type { PromiseToastOptions } from '@/shared/presentation/toast-options';
import type { SileoOptions, SileoPosition } from 'sileo';

/**
 * SileoPromiseOptions is declared in sileo's types but not included
 * in its public export list. We re-declare it here.
 */
interface SileoPromiseOptions<T = unknown> {
    loading: SileoOptions;
    success: SileoOptions | ((data: T) => SileoOptions);
    error: SileoOptions | ((err: unknown) => SileoOptions);
    action?: SileoOptions | ((data: T) => SileoOptions);
    position?: SileoPosition;
};

const DEFAULT_ERROR_DESCRIPTION = 'Please try again later.';

const buildErrorHandler = (base: SileoOptions) =>
    (err: unknown): SileoOptions => {
        if (isApiError(err)) markApiErrorHandled(err);

        const title = isApiError(err)
            ? getErrorMessage(err.code, base.title ?? DEFAULT_ERROR_DESCRIPTION)
            : err instanceof Error && err.message.trim().length > 0
                ? err.message
                : base.title ?? DEFAULT_ERROR_DESCRIPTION;

        return {
            ...base,
            title,
            description: base.description ?? base.title ?? DEFAULT_ERROR_DESCRIPTION
        };
    };

export const showPromise = <T,>(
    promise: Promise<T> | (() => Promise<T>),
    opts: PromiseToastOptions<T>
): Promise<T> => {
    const sileoOpts: SileoPromiseOptions<T> = {
        loading: opts.loading,
        success: opts.success,
        error: buildErrorHandler(opts.error)
    };
    return sileo.promise(promise, sileoOpts);
};
