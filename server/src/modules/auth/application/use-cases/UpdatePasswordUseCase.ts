import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdatePasswordInputDTO, UpdatePasswordOutputDTO } from '@modules/auth/application/dtos/UpdatePasswordDTO';
import { IUserRepository } from '@modules/auth/domain/ports/IUserRepository';
import { IPasswordHasher } from '@modules/auth/domain/ports/IPasswordHasher';
import { ITokenService } from '@modules/auth/domain/ports/ITokenService';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import { ISessionRepository } from '@modules/session/domain/ports/ISessionRepository';
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';

@injectable()
export default class UpdatePasswordUseCase implements IUseCase<UpdatePasswordInputDTO, UpdatePasswordOutputDTO, ApplicationError> {
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly useRepository: IUserRepository,
        @inject(AUTH_TOKENS.BcryptPasswordHasher)
        private readonly passwordHasher: IPasswordHasher,
        @inject(AUTH_TOKENS.JwtTokenService)
        private readonly tokenService: ITokenService,
        @inject(AUTH_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: UpdatePasswordInputDTO): Promise<Result<UpdatePasswordOutputDTO, ApplicationError>> {
        const user = await this.useRepository.findByIdWithPassword(input.userId);
        if (!user) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
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

        const hashedPassword = await this.passwordHasher.hash(input.password);
        await this.useRepository.updatePassword(input.userId, hashedPassword);

        await this.useRepository.updateLastLogin(input.userId);

        const token = this.tokenService.sign(input.userId);

        await this.sessionRepository.create({
            user: user.id,
            token,
            userAgent: input.userAgent,
            ip: input.ip,
            isActive: true,
            lastActivity: new Date(),
            action: SessionActivityType.PasswordUpdate,
            success: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // @ts-ignore
        return Result.ok({
            token,
            user
        });
    }
};