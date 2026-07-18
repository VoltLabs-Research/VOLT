import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';

export const PASSWORD_MIN_LENGTH = 8;

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
