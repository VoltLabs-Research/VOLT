/**
 * Utility for consistent API error context extraction and logging
 */

export interface ApiErrorContext {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    statusText?: string;
    errorMessage?: string;
    serverMessage?: string;
    errorCode?: string;
    resourceId?: string;
    payload?: any;
    response?: any;
    timestamp: string;
}

/**
 * Extract detailed error context from any error object
 */
export const extractErrorContext = (error: any, context?: Partial<ApiErrorContext>): ApiErrorContext => {
    return {
        statusCode: error?.response?.status,
        statusText: error?.response?.statusText,
        errorMessage: error?.message || 'Unknown error',
        errorCode: error?.code,
        serverMessage: error?.response?.data?.message,
        response: error?.response?.data,
        timestamp: new Date().toISOString(),
        ...context
    };
};

/**
 * Create a user-friendly error message from error context
 */
export const formatErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred';
    
    // Server provided message
    if (error?.response?.data?.message) {
        return error.response.data.message;
    }
    
    // Status code messages
    if (error?.response?.status) {
        const status = error.response.status;
        if (status === 401) return 'Unauthorized - please log in again';
        if (status === 403) return 'You do not have permission to perform this action';
        if (status === 404) return 'Resource not found';
        if (status === 409) return 'Conflict - resource already exists or has been modified';
        if (status === 422) return 'Invalid data provided';
        if (status === 429) return 'Too many requests - please try again later';
        if (status === 500) return 'Server error - please try again later';
        if (status === 502) return 'Bad gateway - service temporarily unavailable';
        if (status === 503) return 'Service temporarily unavailable';
        if (status >= 500) return 'Server error - please try again later';
        if (status >= 400) return 'Request failed - please check your input';
    }
    
    // Network errors
    if (error?.code === 'ECONNABORTED') return 'Request timeout - please try again';
    if (error?.code === 'ERR_NETWORK') return 'Network error - please check your connection';
    
    // Generic message
    return error?.message || 'An unknown error occurred';
};

/**
 * Log error with full context
 */
export const logApiError = (
    label: string,
    error: any,
    context?: Partial<ApiErrorContext>
): void => {
    const errorContext = extractErrorContext(error, context);
    console.error(`${label}:`, errorContext);
};
