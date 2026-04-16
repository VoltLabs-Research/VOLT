import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

const DAEMON_DISCONNECT_MESSAGES = [
    'Team cluster daemon connection was lost',
    'Team cluster daemon reverse channel is not connected',
    'Team cluster daemon connection is not ready yet',
    'Object gateway request timed out'
];

const RETRYABLE_ERROR_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ETIMEDOUT'
]);

const getErrorMessage = (error: unknown): string | undefined => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return undefined;
};

/** Identifies transient daemon transport failures that should be retried. */
export const isRetryableTeamClusterTransportError = (error: unknown): boolean => {
    if (error instanceof ApplicationError && error.statusCode === 503) {
        return true;
    }

    if (isRecord(error) && typeof error.code === 'string' && RETRYABLE_ERROR_CODES.has(error.code)) {
        return true;
    }

    const message = getErrorMessage(error)?.trim();
    if (!message) {
        return false;
    }

    return DAEMON_DISCONNECT_MESSAGES.includes(message)
        || message === 'socket hang up'
        || message.startsWith('read ECONNRESET')
        || message.startsWith('connect ECONNREFUSED');
};
