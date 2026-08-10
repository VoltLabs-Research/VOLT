/**
 * Fallback messages for the error codes the SDK itself produces: HTTP status
 * fallbacks (see `getHttpFallbackCode`) and transport failures (see the HTTP
 * adapters).
 *
 * Domain-specific server codes (Team, Trajectory, Container, …) are deliberately
 * NOT duplicated here. The SDK surfaces the server's own `code`/`message`
 * verbatim via `ApiError`, so this table cannot drift out of sync with the
 * backend's error catalogue.
 */
export const ERROR_CODE_MESSAGES: Record<string, string> = {
    // HTTP status fallbacks
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

    // Transport failures
    'Network::Timeout': 'Request timeout - Check your connection',
    'Network::ConnectionError': 'Network connection error - Check your internet connection',
    'Internal::Server::Error': 'An unexpected error occurred',
};

/**
 * Returns a human-readable message for an error code, falling back to the
 * supplied default (the code itself, by convention) for server-domain codes
 * that are not listed here.
 */
export const getErrorMessage = (code: string, fallback: string = 'Unknown error'): string => {
    return ERROR_CODE_MESSAGES[code] || fallback;
};
