import { SignInInputDTO, SignInOutputDTO } from '@modules/auth/application/dtos/SignInDTO';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import AuthSessionService from '@modules/auth/services/AuthSessionService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';

@injectable()
export default class SignInUseCase implements IUseCase<SignInInputDTO, SignInOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.PasswordHasher)
        private readonly passwordHasher: IPasswordHasher,
        @inject(SESSION_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository,
        @inject(AUTH_TOKENS.AuthSessionService)
        private readonly authSessionService: AuthSessionService
    ) {}

    async execute(input: SignInInputDTO): Promise<Result<SignInOutputDTO, ApplicationError>>{
        const user = await this.userRepository.findByEmailWithPassword(input.email);
        if(!user){
            await this.sessionRepository.createFailedLogin(
                null,
                input.userAgent,
                input.ip,
                'User not found'
            );

            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Invalid email or password'
            ));
        }

        const isPasswordValid = await this.passwordHasher.compare(input.password, user.password);
        if(!isPasswordValid){
            await this.sessionRepository.createFailedLogin(
                user._id,
                input.userAgent,
                input.ip,
                'Invalid password'
            );

            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Invalid email or password'
            ));
        }

        await this.userRepository.updateLastLogin(user._id);
        
        const token = await this.authSessionService.createSessionWithToken({
            userId: user._id,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.Login
        });

        return Result.ok({
            token,
            user: toPersistedUserDTO(user)
        });
    }
};
