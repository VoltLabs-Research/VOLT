import { isApiError, markApiErrorHandled, isHandledApiError } from '@/shared/errors/notify-api-error';
import { normalizeError } from '@/shared/errors/core/normalize-error';
import { mapErrorToUserMessage } from '@/shared/errors/core/map-error-to-user-message';
import { sileo } from 'sileo';
import type { ReportErrorOptions, UserFacingError } from '@/shared/errors/core/types';

/** Minimal no-op result returned when the error was already handled. */
const HANDLED_NOOP: UserFacingError = {
    title: '',
    retryable: false,
    surface: 'silent'
};

/**
 * Central error reporting entry point.
 *
 * Normalizes any thrown value, maps it to a user-facing message, and
 * optionally surfaces it as a toast. Returns the structured result so
 * callers can render inline or page-level feedback when needed.
 *
 * @param error - The raw error from a catch block or rejection handler.
 * @param options - Presentation and fallback overrides.
 * @returns The resolved UserFacingError for further use by the caller.
 */
export const reportError = (
    error: unknown,
    options?: ReportErrorOptions
): UserFacingError => {
    if (isHandledApiError(error)) {
        return HANDLED_NOOP;
    }

    const appError = normalizeError(error);
    const userError = mapErrorToUserMessage(appError, options);

    if (userError.surface === 'toast') {
        sileo.error({
            title: userError.title,
            description: userError.description
        });

        if (isApiError(error)) {
            markApiErrorHandled(error);
        }
    }

    if (userError.surface === 'silent') {
        // No visual feedback — caller may still inspect the returned value.
    }

    // 'inline' and 'page' surfaces: the caller is responsible for rendering.

    options?.onError?.(userError);

    return userError;
};
