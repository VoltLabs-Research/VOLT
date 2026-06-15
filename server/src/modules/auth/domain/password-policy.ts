import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';

/**
 * Minimum password length enforced server-side at every credential-setting boundary
 * (sign-up + password change). Matches the "min. 8 characters" the client advertises.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Validate a raw password at a trust boundary (untyped HTTP input). Returns an
 * ApplicationError (400) when the password is missing or too short, otherwise null.
 * Length is measured in code points so multi-byte characters each count once.
 */
export const validatePassword = (password: unknown): ApplicationError | null => {
    if (typeof password !== 'string' || password.length === 0) {
        return ApplicationError.badRequest(
            ErrorCodes.AUTH_PASSWORD_REQUIRED,
            'Password is required'
        );
    }

    if ([...password].length < PASSWORD_MIN_LENGTH) {
        return ApplicationError.badRequest(
            ErrorCodes.AUTH_PASSWORD_TOO_SHORT,
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
        );
    }

    return null;
};
