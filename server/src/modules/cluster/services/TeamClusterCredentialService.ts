import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';
import crypto from 'node:crypto';

interface PasswordConfirmationUserLookup {
    findByIdWithPassword(userId: string): Promise<{ password?: string | null } | null>;
}

interface PasswordConfirmationHasher {
    compare(password: string, hash: string): Promise<boolean>;
}

interface AssertConfirmedPasswordParams {
    userRepository: PasswordConfirmationUserLookup;
    passwordHasher: PasswordConfirmationHasher;
    userId: string;
    password: string;
}

export const assertConfirmedPassword = async ({
    userRepository,
    passwordHasher,
    userId,
    password
}: AssertConfirmedPasswordParams): Promise<ApplicationError | null> => {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
        return ApplicationError.notFound(
            ErrorCodes.USER_NOT_FOUND,
            'User not found'
        );
    }

    if (!user.password) {
        return ApplicationError.badRequest(
            'TeamCluster::PasswordConfirmationUnavailable',
            'Password confirmation is not available for this account'
        );
    }

    const isPasswordValid = await passwordHasher.compare(password, user.password);
    if (!isPasswordValid) {
        return ApplicationError.badRequest(
            ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
            'Password confirmation failed'
        );
    }

    return null;
};

export const secureCompare = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const createEnrollmentToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
};

export const hashEnrollmentToken = (enrollmentToken: string): string => {
    return crypto.createHash('sha256')
        .update(enrollmentToken)
        .digest('hex');
};

export default class TeamClusterCredentialService {
    async encrypt(value: string): Promise<string> {
        return encrypt(value);
    }

    async decrypt(value: string): Promise<string> {
        return decrypt(value);
    }
}
