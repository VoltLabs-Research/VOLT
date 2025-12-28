import { ApiError } from '@/api/api-error';

/**
 * Extract user-friendly error message from any error type
 * Handles ApiError(from interceptors) and raw axios errors
 */
export const extractErrorMessage = (
    error: any,
    fallback: string = 'An error occurred'
): string => {
    // Handle classified ApiError from interceptors
    if(error instanceof ApiError){
        return error.getUserMessage();
    }

    // Handle raw axios error response
    if(error?.response?.data?.message){
        return error.response.data.message;
    }

    // Handle generic error message
    if(error?.message){
        return error.message;
    }

    return fallback;
};
