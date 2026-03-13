import { isApiError, isHandledApiError, markApiErrorHandled } from '@/shared/errors/core/api-error-guards';
import { normalizeError } from '@/shared/errors/core/normalize-error';
import { mapErrorToUserMessage } from '@/shared/errors/core/map-error-to-user-message';
import { ErrorSurface } from '@/shared/errors/core/types';
import { sileo } from 'sileo';
import type { ReportErrorOptions, UserFacingError } from '@/shared/errors/core/types';

/** Minimal no-op result returned when the error was already handled. */
const HANDLED_NOOP: UserFacingError = Object.freeze({
    title: '',
    retryable: false,
    surface: ErrorSurface.Silent
});

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

    if (userError.surface === ErrorSurface.Toast) {
        sileo.error({
            title: userError.title,
            description: userError.description
        });

        if (isApiError(error)) {
            markApiErrorHandled(error);
        }
    }

    // 'silent', 'inline', and 'page' surfaces: no toast shown.
    // The caller is responsible for rendering inline/page feedback.

    options?.onError?.(userError);

    return userError;
};
