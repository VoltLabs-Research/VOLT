import type { AppError, ErrorKind, ErrorSurface, ReportErrorOptions, UserFacingError } from '@/shared/errors/core/types';

const GENERIC_MESSAGES: ReadonlySet<string> = new Set([
    'Unknown error',
    'Something went wrong. Please try again.'
]);

const DEFAULT_SURFACE_BY_KIND: Record<ErrorKind, ErrorSurface> = {
    api: 'toast',
    permission: 'toast',
    validation: 'inline',
    network: 'toast',
    auth: 'toast',
    'not-found': 'toast',
    conflict: 'toast',
    'rate-limit': 'toast',
    server: 'toast',
    unknown: 'toast'
};

/**
 * Resolves the description for a given error kind, falling back to
 * the caller-provided description when the kind has no fixed copy.
 */
const resolveDescription = (
    kind: ErrorKind,
    fallbackDescription?: string
): string | undefined => {
    switch (kind) {
        case 'network':
            return 'Check your internet connection and try again.';
        case 'auth':
            return 'Please sign in again to continue.';
        case 'rate-limit':
            return 'You\'ve made too many requests. Please wait a moment.';
        case 'server':
            return 'Our servers are experiencing issues. Please try again later.';
        case 'validation':
            return fallbackDescription ?? 'Please check the form fields and try again.';
        case 'unknown':
            return 'An unexpected error occurred. Please try again.';
        case 'permission':
        case 'api':
        case 'not-found':
        case 'conflict':
            return fallbackDescription;
    }
};

/**
 * Resolves the action label based on retryability and error kind.
 */
const resolveActionLabel = (kind: ErrorKind, retryable: boolean): string | undefined => {
    if (retryable) return 'Try again';
    if (kind === 'auth') return 'Sign in';
    return undefined;
};

/**
 * Maps a normalized AppError into a UserFacingError suitable for
 * rendering in the UI (toast, inline message, or error page).
 *
 * @param appError - The normalized error produced by `normalizeError`.
 * @param options - Optional overrides for surface, fallback title, and description.
 * @returns A user-facing error object ready for presentation.
 */
export const mapErrorToUserMessage = (
    appError: AppError,
    options?: ReportErrorOptions
): UserFacingError => {
    const surface = options?.surface ?? DEFAULT_SURFACE_BY_KIND[appError.kind];

    let title = appError.friendlyMessage;
    if (GENERIC_MESSAGES.has(title) && options?.fallbackTitle) {
        title = options.fallbackTitle;
    }

    const description = resolveDescription(appError.kind, options?.fallbackDescription);
    const actionLabel = resolveActionLabel(appError.kind, appError.retryable);

    return {
        title,
        description,
        actionLabel,
        retryable: appError.retryable,
        surface,
        fieldErrors: appError.fieldErrors
    };
};
