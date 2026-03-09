import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';

interface AssertConfirmedPasswordParams {
    userRepository: IUserRepository;
    passwordHasher: IPasswordHasher;
    userId: string;
    password: string;
};

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
