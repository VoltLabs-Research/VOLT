import type { AxiosError } from 'axios';
import { ErrorType } from '@/types/api';
import { ApiError } from '@/api/api-error';

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

const extractErrorMessage = (data: ErrorResponse | unknown): string => {
    if(!data || typeof data !== 'object'){
        return 'Unknown error';
    }

    const errorData = data as ErrorResponse;
    return errorData.message || 'Uknown error';
};

const classifyNetworkError = (error: AxiosError): ApiError => {
    if(error.code === 'ECONNABORTED'){
        return new ApiError(
            ErrorType.TIMEOUT, 
            'The request took too long (timeout)', 
            undefined, 
            error
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
            error
        );
    }

    return new ApiError(
        ErrorType.UNKNOWN,
        error.message || 'Unknown error',
        undefined,
        error
    );
}

export const classifyHttpError = (error: AxiosError): ApiError => {
    const status = error.response!.status;
    const data = error.response!.data as ErrorResponse | undefined;
    const message = extractErrorMessage(data);

    const type = HTTP_ERROR_MAP[status] || ErrorType.UNKNOWN;

    return new ApiError(type, message, status, error);
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

