import { normalizeError } from '@/shared/errors/core/normalize-error';
import { mapErrorToUserMessage } from '@/shared/errors/core/map-error-to-user-message';
import { isApiError, markApiErrorHandled } from '@/shared/errors/core';
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

        const appError = normalizeError(err);
        const userMessage = mapErrorToUserMessage(appError, { fallbackTitle: base.title });

        return {
            ...base,
            title: userMessage.title,
            description: base.description ?? userMessage.description ?? base.title ?? DEFAULT_ERROR_DESCRIPTION
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
