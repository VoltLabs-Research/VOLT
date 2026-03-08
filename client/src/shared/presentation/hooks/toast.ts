import ApiError from '@/shared/errors/ApiError';
import { sileo } from 'sileo';
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

interface ToastPromiseOptions<T = unknown> {
    loading: SileoOptions;
    success: SileoOptions | ((data: T) => SileoOptions);
    error: SileoOptions;
};

const DEFAULT_ERROR_DESCRIPTION = 'Please try again later.';

const buildErrorHandler = (base: SileoOptions) =>
    (err: unknown): SileoOptions => {
        const description = err instanceof ApiError
            ? err.getFriendlyMessage()
            : (base.description ?? DEFAULT_ERROR_DESCRIPTION);
        return { ...base, description };
    };

export const showPromise = <T,>(
    promise: Promise<T> | (() => Promise<T>),
    opts: ToastPromiseOptions<T>
): Promise<T> => {
    const sileoOpts: SileoPromiseOptions<T> = {
        loading: opts.loading,
        success: opts.success,
        error: buildErrorHandler(opts.error)
    };
    return sileo.promise(promise, sileoOpts);
};
