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
    code?: string;
    status?: string;
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

/**
 * Extract error code from server response
 * The error code is in data.code field (format: "Category::Subcategory::Type")
 */
const extractErrorCode = (data: any): string | undefined => {
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return parsed?.code;
        } catch {
            return undefined;
        }
    }
    return data?.code;
};

const classifyNetworkError = (error: AxiosError): ApiError => {
    if(error.code === 'ECONNABORTED'){
        return new ApiError(
            ErrorType.TIMEOUT, 
            'Network::Timeout', 
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
            'Network::ConnectionError',
            undefined,
            error
        );
    }

    return new ApiError(
        ErrorType.UNKNOWN,
        'Network::Unknown',
        undefined,
        error
    );
}

export const classifyHttpError = (error: AxiosError): ApiError => {
    const status = error.response!.status;
    const data = error.response!.data as ErrorResponse | undefined;
    
    // Try to extract error code from server response
    const errorCode = extractErrorCode(data);
    
    const type = HTTP_ERROR_MAP[status] || ErrorType.UNKNOWN;
    
    // Use server error code if available, otherwise fall back to HTTP status message code
    const finalCode = errorCode || `Http::${status}`;
    
    return new ApiError(type, finalCode, status, error);
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

