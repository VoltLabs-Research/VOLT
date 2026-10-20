export const ERROR_CODE_MESSAGES: Record<string, string> = {
    'Http::400': 'Bad Request',
    'Http::401': 'Unauthorized - Please sign in again',
    'Http::403': 'Forbidden',
    'Http::404': 'Resource not found',
    'Http::409': 'Conflict',
    'Http::429': 'Too many requests - Please try again later',
    'Http::500': 'Server error',
    'Http::502': 'Service temporarily unavailable',
    'Http::503': 'Service temporarily unavailable',
    'Http::504': 'Service temporarily unavailable',

    'Network::Timeout': 'Request timeout - Check your connection',
    'Network::ConnectionError': 'Network connection error - Check your internet connection',
    'Internal::Server::Error': 'An unexpected error occurred',
};

export const getErrorMessage = (code: string, fallback: string = 'Unknown error'): string => {
    return ERROR_CODE_MESSAGES[code] || fallback;
};
