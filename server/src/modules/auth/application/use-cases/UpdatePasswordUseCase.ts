import { ErrorCodes } from '@core/constants/error-codes';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import { UpdatePasswordInputDTO, UpdatePasswordOutputDTO } from '@modules/auth/application/dtos/UpdatePasswordDTO';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import AuthSessionService from '@modules/auth/infrastructure/services/AuthSessionService';
import BcryptPasswordHasher from '@modules/auth/infrastructure/services/BcryptPasswordHasher';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class UpdatePasswordUseCase implements IUseCase<UpdatePasswordInputDTO, UpdatePasswordOutputDTO, ApplicationError> {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly passwordHasher: BcryptPasswordHasher,
        private readonly authSessionService: AuthSessionService
    ) {}

    async execute(input: UpdatePasswordInputDTO): Promise<Result<UpdatePasswordOutputDTO, ApplicationError>> {
        const user = await this.userRepository.findByIdWithPassword(input.userId);
        if (!user) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            ));
        }

        if (user.password) {
            if (!input.passwordCurrent) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                    'Current password is required'
                ));
            }

            const isCurrentPasswordValid = await this.passwordHasher.compare(
                input.passwordCurrent,
                user.password
            );

            if (!isCurrentPasswordValid) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                    'Current password is incorrect'
                ));
            }
        }

        const hashedPassword = await this.passwordHasher.hash(input.password);
        await this.userRepository.updatePassword(input.userId, hashedPassword);

        await this.userRepository.updateLastLogin(input.userId);

        const token = await this.authSessionService.createSessionWithToken({
            userId: input.userId,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.PasswordUpdate
        });

        const updatedUser = await this.userRepository.findById(input.userId);
        if (!updatedUser) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found after update'
            ));
        }

        return Result.ok({
            token,
            user: toPersistedUserDTO(updatedUser)
        });
    }
}
