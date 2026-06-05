import { ErrorCodes } from '@core/constants/error-codes';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import { UpdatePasswordInputDTO, UpdatePasswordOutputDTO } from '@modules/auth/application/dtos/UpdatePasswordDTO';
import type { IAuthSessionService } from '@modules/auth/domain/port/IAuthSessionService';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class UpdatePasswordUseCase implements IUseCase<UpdatePasswordInputDTO, UpdatePasswordOutputDTO, ApplicationError> {
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.PasswordHasher) private readonly passwordHasher: IPasswordHasher,
        @inject(AUTH_TOKENS.AuthSessionService) private readonly authSessionService: IAuthSessionService
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
