import { isApiError } from '@/shared/errors/core/api-error-guards';
import { ErrorKind } from '@/shared/errors/core/types';
import type { ApiError } from '@voltstack/voltclient';
import type { AppError } from '@/shared/errors/core/types';

const NETWORK_PATTERNS = [
    'timeout',
    'network',
    'offline',
    'econnrefused',
    'err_network',
    'fetch failed'
];

const DEFAULT_FRIENDLY_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Determines the error kind from an ApiError based on its code and HTTP status.
 */
const classifyApiError = (error: ApiError): ErrorKind => {
    const code = error.code ?? '';
    const status = error.status;

    if (error.isPermissionDenied()) return ErrorKind.Permission;
    if (code.startsWith('Validation::')) return ErrorKind.Validation;
    if (code.startsWith('Auth::') || code.startsWith('Authentication::') || code.startsWith('OAuth::')) return ErrorKind.Auth;
    if (code.includes('NotFound') || status === 404) return ErrorKind.NotFound;
    if (code.includes('Duplicate') || code.includes('AlreadyExists') || code.includes('Conflict') || status === 409) return ErrorKind.Conflict;
    if (status === 429 || code.includes('RateLimit') || code.includes('TooMany')) return ErrorKind.RateLimit;
    if (code.startsWith('Network::')) return ErrorKind.Network;
    if (status !== undefined && status >= 500) return ErrorKind.Server;

    return ErrorKind.Api;
};

const RETRYABLE_KINDS: ReadonlySet<ErrorKind> = new Set([
    ErrorKind.Network,
    ErrorKind.Server,
    ErrorKind.RateLimit,
    ErrorKind.Unknown
]);

/**
 * Determines whether an error of the given kind is retryable.
 */
const isRetryable = (kind: ErrorKind): boolean => RETRYABLE_KINDS.has(kind);

/**
 * Checks whether a message looks like a readable user-facing string
 * rather than a stack trace or internal error dump.
 */
const isReadableMessage = (message: string): boolean => {
    if (message.length > 300) return false;
    if (message.includes('\n') && message.split('\n').length > 3) return false;
    if (message.includes('    at ')) return false;

    return true;
};

/**
 * Checks whether a plain Error message matches known network error patterns.
 */
const isNetworkMessage = (message: string): boolean => {
    const lower = message.toLowerCase();
    return NETWORK_PATTERNS.some((pattern) => lower.includes(pattern));
};

/**
 * Normalizes any thrown value into a structured AppError.
 *
 * @param error - The raw error from a catch block or rejection handler.
 * @returns A consistently shaped AppError regardless of the input type.
 */
export const normalizeError = (error: unknown): AppError => {
    if (isApiError(error)) {
        const kind = classifyApiError(error);

        return {
            kind,
            code: error.code,
            httpStatus: error.status ?? null,
            message: error.message,
            friendlyMessage: error.getFriendlyMessage(),
            retryable: isRetryable(kind),
            original: error
        };
    }

    if (error instanceof Error) {
        if (isNetworkMessage(error.message)) {
            return {
                kind: ErrorKind.Network,
                code: null,
                httpStatus: null,
                message: error.message,
                friendlyMessage: 'A network error occurred. Please check your connection.',
                retryable: true,
                original: error
            };
        }

        const friendlyMessage = isReadableMessage(error.message)
            ? error.message
            : DEFAULT_FRIENDLY_MESSAGE;

        return {
            kind: ErrorKind.Unknown,
            code: null,
            httpStatus: null,
            message: error.message,
            friendlyMessage,
            retryable: true,
            original: error
        };
    }

    if (typeof error === 'string' && error.length > 0) {
        return {
            kind: ErrorKind.Unknown,
            code: null,
            httpStatus: null,
            message: error,
            friendlyMessage: isReadableMessage(error) ? error : DEFAULT_FRIENDLY_MESSAGE,
            retryable: true,
            original: error
        };
    }

    return {
        kind: ErrorKind.Unknown,
        code: null,
        httpStatus: null,
        message: 'Unknown error',
        friendlyMessage: DEFAULT_FRIENDLY_MESSAGE,
        retryable: true,
        original: error
    };
};
