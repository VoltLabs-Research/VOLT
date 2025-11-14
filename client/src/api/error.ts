import type { AxiosError } from 'axios';
import { ErrorType } from '@/types/api';
import { ApiError, type ApiErrorContext } from '@/api/api-error';

interface ErrorClassificationMap{
    [key: number]: ErrorType;
}

interface ErrorResponse{
    message?: string;
    error?: string;
    errors?: unknown;
    detail?: string;
}

const HTTP_ERROR_MAP: ErrorClassificationMap = {
    400: ErrorType.VALIDATION,
    401: ErrorType.AUTH,
    403: ErrorType.FORBIDDEN,
    404: ErrorType.NOT_FOUND,
    409: ErrorType.CONFLICT,
    429: ErrorType.RATE_LIMIT,
    500: ErrorType.SERVER_ERROR,
    502: ErrorType.SERVER_ERROR,
    503: ErrorType.SERVER_ERROR,
    504: ErrorType.SERVER_ERROR,
};

const HTTP_STATUS_MESSAGES: { [key: number]: string } = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Resource Not Found',
    409: 'Conflict',
    429: 'Too Many Requests',
    500: 'Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
};

const extractErrorMessage = (data: ErrorResponse | unknown): string => {
    if(!data || typeof data !== 'object'){
        return 'Unknown error';
    }

    const errorData = data as ErrorResponse;
    return errorData.message || errorData.error || errorData.detail || 'Unknown error';
};

const extractContextFromError = (error: AxiosError, errorMessage: string): ApiErrorContext => {
    const config = error.config;
    const status = error.response?.status;
    
    return {
        endpoint: config?.url || 'unknown',
        method: (config?.method || 'GET').toUpperCase(),
        statusCode: status,
        statusText: error.response?.statusText || HTTP_STATUS_MESSAGES[status || 0] || 'Unknown',
        errorMessage: error.message || 'Unknown error',
        serverMessage: extractErrorMessage(error.response?.data),
        timestamp: new Date().toISOString()
    };
};

const classifyNetworkError = (error: AxiosError): ApiError => {
    const context: ApiErrorContext = {
        endpoint: error.config?.url || 'unknown',
        method: (error.config?.method || 'GET').toUpperCase(),
        errorMessage: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
    };

    if(error.code === 'ECONNABORTED'){
        return new ApiError(
            ErrorType.TIMEOUT, 
            'The request took too long (timeout)', 
            undefined, 
            error,
            context
        );
    }

    if(
        error.message === 'Network Error' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        !navigator.onLine
    ){
        return new ApiError(
            ErrorType.NETWORK,
            'Internet connection error. Check your connection.',
            undefined,
            error,
            context
        );
    }

    return new ApiError(
        ErrorType.UNKNOWN,
        error.message || 'Unknown error',
        undefined,
        error,
        context
    );
}

export const classifyHttpError = (error: AxiosError): ApiError => {
    const status = error.response!.status;
    const data = error.response!.data as ErrorResponse | undefined;
    const serverMessage = extractErrorMessage(data);
    
    // Use a more user-friendly message based on status code
    const defaultMessage = HTTP_STATUS_MESSAGES[status] || 'Unknown error';
    const finalMessage = serverMessage !== 'Unknown error' ? serverMessage : defaultMessage;

    const type = HTTP_ERROR_MAP[status] || ErrorType.UNKNOWN;
    
    const context = extractContextFromError(error, finalMessage);
    // Override server message with the extracted one
    context.serverMessage = serverMessage;

    return new ApiError(type, finalMessage, status, error, context);
};

export const classifyError = (error: unknown): ApiError => {
    if(error instanceof ApiError){
        return error;
    }

    const axiosError = error as AxiosError;

    if(!axiosError.response){
        return classifyNetworkError(axiosError);
    }

    return classifyHttpError(axiosError);
};

