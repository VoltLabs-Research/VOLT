import { ApiError, getErrorMessage } from '@voltstack/voltclient';
import { ErrorSurface } from '@/shared/errors/core/types';
import { sileo } from 'sileo';
import type { ReportErrorOptions, UserFacingError } from '@/shared/errors/core/types';

const DEFAULT_ERROR_TITLE = 'Something went wrong. Please try again.';

const HANDLED_NOOP: UserFacingError = Object.freeze({
    title: '',
    surface: ErrorSurface.Silent
});

export const isApiError = (error: unknown): error is ApiError => {
    return error instanceof ApiError;
};

export const isAccessDeniedCode = (code: string): boolean => {
    return ApiError.isCodePermissionDenied(code);
};

export const isAccessDeniedError = (error: unknown): error is ApiError => {
    return isApiError(error) && error.isPermissionDenied();
};

const isHandledApiError = (error: unknown): error is ApiError => {
    return isApiError(error) && error.isHandled();
};

export const markApiErrorHandled = (error: unknown): void => {
    if (isApiError(error)) {
        error.markHandled();
    }
};

export const resolveErrorTitle = (error: unknown, fallbackTitle?: string): string => {
    if (isApiError(error)) {
        return getErrorMessage(error.code, fallbackTitle ?? DEFAULT_ERROR_TITLE);
    }

    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
        return error;
    }

    return fallbackTitle ?? DEFAULT_ERROR_TITLE;
};

export const reportError = (
    error: unknown,
    options?: ReportErrorOptions
): UserFacingError => {
    if (isHandledApiError(error)) {
        return HANDLED_NOOP;
    }

    const userError: UserFacingError = {
        title: resolveErrorTitle(error, options?.fallbackTitle),
        description: options?.fallbackDescription,
        surface: options?.surface ?? ErrorSurface.Toast
    };

    if (userError.surface === ErrorSurface.Toast) {
        sileo.error({
            title: userError.title,
            description: userError.description
        });

        if (isApiError(error)) {
            markApiErrorHandled(error);
        }
    }

    options?.onError?.(userError);

    return userError;
};
