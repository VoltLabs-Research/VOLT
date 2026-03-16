const DAEMON_DISCONNECT_MESSAGES = [
    'Team cluster daemon connection was lost',
    'Team cluster daemon reverse channel is not connected',
    'Team cluster daemon connection is not ready yet'
];

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
    const message = getErrorMessage(error)?.trim();
    if (!message) {
        return false;
    }

    return DAEMON_DISCONNECT_MESSAGES.includes(message);
};
