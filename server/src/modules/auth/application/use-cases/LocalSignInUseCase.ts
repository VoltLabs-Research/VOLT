import { ErrorCodes } from '@core/constants/error-codes';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import { SignInOutputDTO } from '@modules/auth/application/dtos/SignInDTO';
import type { IAuthSessionService } from '@modules/auth/domain/port/IAuthSessionService';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

export interface LocalSignInInputDTO {
    ip: string;
    userAgent: string;
}

/**
 * Credential-less sign-in for the single-tenant desktop deployment. Only active
 * when DEPLOYMENT_MODE=local, where there is exactly one canonical user
 * (`local@volt.local`, provisioned by the desktop bootstrap) and nobody else can
 * reach the server. Mints a session for that user so the client always
 * auto-logs-in. In cloud mode this is treated as if the route does not exist.
 */
@injectable()
export default class LocalSignInUseCase implements IUseCase<LocalSignInInputDTO, SignInOutputDTO, ApplicationError> {
    private static readonly LOCAL_USER_EMAIL = 'local@volt.local';

    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.AuthSessionService) private readonly authSessionService: IAuthSessionService
    ) {}

    async execute(input: LocalSignInInputDTO): Promise<Result<SignInOutputDTO, ApplicationError>> {
        if (process.env.DEPLOYMENT_MODE !== 'local') {
            // Invisible in cloud: behave as if the route does not exist.
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'Not found'
            ));
        }

        const user = await this.userRepository.findByEmail(LocalSignInUseCase.LOCAL_USER_EMAIL);
        if (!user) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'Local user is not provisioned yet'
            ));
        }

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
}
