import { ErrorCodes } from '@core/constants/error-codes';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import { SignInInputDTO, SignInOutputDTO } from '@modules/auth/application/dtos/SignInDTO';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import AuthSessionService from '@modules/auth/infrastructure/services/AuthSessionService';
import BcryptPasswordHasher from '@modules/auth/infrastructure/services/BcryptPasswordHasher';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class SignInUseCase implements IUseCase<SignInInputDTO, SignInOutputDTO, ApplicationError>{
    constructor(
        
        private readonly userRepository: UserRepository,
        
        private readonly passwordHasher: BcryptPasswordHasher,
        
        private readonly sessionRepository: SessionRepository,
        
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
