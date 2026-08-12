import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import type {
    SignInInput,
    SignUpInput,
    UpdatePasswordInput
} from '@volt/contracts/modules/auth/http';


const PASSWORD_MIN_LENGTH = 8;

const readText = (raw: unknown, name: string): string | undefined => {
    const value = isRecord(raw) ? raw[name] : undefined;

    return typeof value === 'string' ? value : undefined;
};

const requireText = (raw: unknown, name: string, error: ApplicationError): string => {
    const value = readText(raw, name);
    if (!value?.trim()) throw error;

    return value;
};

const requirePassword = (raw: unknown): string => {
    const password = requireText(raw, 'password', ApplicationError.badRequest(
        ErrorCodes.AUTH_PASSWORD_REQUIRED,
        'Password is required'
    ));

    if ([...password].length < PASSWORD_MIN_LENGTH) {
        throw ApplicationError.badRequest(
            ErrorCodes.AUTH_PASSWORD_TOO_SHORT,
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
        );
    }

    return password;
};

export const signInBody = (raw: unknown): SignInInput => {
    const invalid = ApplicationError.unauthorized(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Invalid email or password');

    return {
        email: requireText(raw, 'email', invalid),
        password: requireText(raw, 'password', invalid)
    };
};

export const signUpBody = (raw: unknown): SignUpInput => {
    const nameRequired = ApplicationError.badRequest(ErrorCodes.AUTH_NAME_REQUIRED, 'First and last name are required');
    const lastName = readText(raw, 'lastName');
    if (lastName === undefined) throw nameRequired;

    return {
        email: requireText(raw, 'email', ApplicationError.badRequest(ErrorCodes.AUTH_EMAIL_REQUIRED, 'Email is required')),
        firstName: requireText(raw, 'firstName', nameRequired),
        lastName,
        password: requirePassword(raw)
    };
};

export const updatePasswordBody = (raw: unknown): UpdatePasswordInput => ({
    password: requirePassword(raw),
    passwordCurrent: readText(raw, 'passwordCurrent')
});
