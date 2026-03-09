import ApiError from './ApiError';
import { sileo } from 'sileo';

interface NotifyApiErrorOptions {
    fallbackTitle?: string;
    fallbackDescription?: string;
};

export const isApiError = (error: unknown): error is ApiError => {
    return error instanceof ApiError;
};

export const isAccessDeniedCode = (code: string): boolean => {
    return ApiError.isCodePermissionDenied(code);
};

export const isAccessDeniedError = (error: unknown): error is ApiError => {
    return isApiError(error) && error.isPermissionDenied();
};

export const getApiErrorCode = (error: unknown): string | null => {
    if(!isApiError(error)){
        return null;
    }

    return error.code;
};

export const isHandledApiError = (error: unknown): error is ApiError => {
    return isApiError(error) && error.isHandled();
};

export const markApiErrorHandled = (error: unknown): void => {
    if(isApiError(error)){
        error.markHandled();
    }
};

export const getApiErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
    if(isApiError(error)){
        return error.getFriendlyMessage();
    }

    if(error instanceof Error && error.message){
        return error.message;
    }

    if(typeof error === 'string' && error.length > 0){
        return error;
    }

    return fallback;
};

export const getAccessDeniedMessage = (
    error: unknown,
    fallback = 'You do not have permission to perform this action.'
): string | undefined => {
    if(!isAccessDeniedError(error)){
        return undefined;
    }

    return getApiErrorMessage(error, fallback);
};

export const notifyApiError = (
    error: unknown,
    options?: NotifyApiErrorOptions
): error is ApiError => {
    if(!isApiError(error)){
        return false;
    }

    if(error.isHandled()){
        return true;
    }

    const description = options?.fallbackDescription ?? options?.fallbackTitle;

    sileo.error({
        title: getApiErrorMessage(error, options?.fallbackTitle),
        description
    });

    error.markHandled();

    return true;
};
