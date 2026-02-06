import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SignInInputDTO, SignInOutputDTO } from '@modules/auth/application/dtos/SignInDTO';
import { IUserRepository } from '@modules/auth/domain/ports/IUserRepository';
import { IPasswordHasher } from '@modules/auth/domain/ports/IPasswordHasher';
import { ITokenService } from '@modules/auth/domain/ports/ITokenService';
import { ISessionRepository } from '@modules/session/domain/ports/ISessionRepository';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';

@injectable()
export default class SignInUseCase implements IUseCase<SignInInputDTO, SignInOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.BcryptPasswordHasher)
        private readonly passwordHasher: IPasswordHasher,
        @inject(AUTH_TOKENS.JwtTokenService)
        private readonly tokenService: ITokenService,
        @inject(AUTH_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: SignInInputDTO): Promise<Result<SignInOutputDTO, ApplicationError>>{
        if(!input.email || !input.password){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.AUTH_CREDENTIALS_MISSING,
                'Email and password are required'
            ));
        }

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
                user.id,
                input.userAgent,
                input.ip,
                'Invalid password'
            );

            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Invalid email or password'
            ));
        }

        await this.userRepository.updateLastLogin(user.id);
        
        const token = this.tokenService.sign(user.id);

        await this.sessionRepository.create({
            user: user.id,
            token,
            userAgent: input.userAgent,
            ip: input.ip,
            isActive: true,
            lastActivity: new Date(),
            action: SessionActivityType.Login,
            success: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok({
            token,
            user: user.props
        });
    }
};