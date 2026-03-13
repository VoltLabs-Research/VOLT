import { ApiError } from '@voltstack/voltclient';

/**
 * Type guard that checks whether an unknown value is an ApiError instance.
 */
export const isApiError = (error: unknown): error is ApiError => {
    return error instanceof ApiError;
};

/**
 * Checks whether an API error code represents a permission denial.
 */
export const isAccessDeniedCode = (code: string): boolean => {
    return ApiError.isCodePermissionDenied(code);
};

/**
 * Checks whether an unknown value is a permission-denied ApiError.
 */
export const isAccessDeniedError = (error: unknown): error is ApiError => {
    return isApiError(error) && error.isPermissionDenied();
};

/**
 * Checks whether an ApiError has already been handled (toast shown, etc.).
 */
export const isHandledApiError = (error: unknown): error is ApiError => {
    return isApiError(error) && error.isHandled();
};

/**
 * Marks an ApiError as handled so it is not surfaced again.
 */
export const markApiErrorHandled = (error: unknown): void => {
    if (isApiError(error)) {
        error.markHandled();
    }
};
