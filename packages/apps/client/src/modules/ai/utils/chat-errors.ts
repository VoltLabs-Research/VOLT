// The socket answers with error codes and a failed turn streams one line of copy; the user reads
// neither code nor stack, so each code a turn can fail with gets a sentence they can act on.
const CHAT_ERROR_COPY: Record<string, string> = {
    'AI::Integration::NotConfigured': 'No AI provider is set up for this team yet. Add one in the team settings.',
    'AI::Provider::Unavailable': 'That model is not available to this team. Pick another one.',
    'AI::Turn::InProgress': 'Volt AI is still answering in this conversation.',
    'AI::Conversation::NotJoined': 'Still connecting to this conversation. Try again in a moment.',
    'AI::Conversation::NotFound': 'This conversation no longer exists.',
    'AI::Approval::NotFound': 'That request was already answered.',
    'AI::Turn::Malformed': 'That message could not be sent. Try again.',
    'RBAC::InsufficientPermissions': 'Your role in this team cannot use Volt AI.',
    'Team::AccessDenied': 'You no longer have access to this team.',
    'Internal::Server::Error': 'Volt AI hit a problem. Try again.'
};

export const chatErrorCopy = (error: Error | string | null | undefined): string | null => {
    if (error === null || error === undefined) return null;

    const text = (typeof error === 'string' ? error : error.message).trim();
    if (text === '') return CHAT_ERROR_COPY['Internal::Server::Error'];

    return CHAT_ERROR_COPY[text] ?? text;
};
