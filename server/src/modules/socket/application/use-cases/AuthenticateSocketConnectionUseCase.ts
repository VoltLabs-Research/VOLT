import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ITokenService } from '@modules/auth/domain/port/ITokenService';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { ISocketAuthenticationResult, ISocketConnectionUser } from '@modules/socket/domain/port/ISocketModule';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class AuthenticateSocketConnectionUseCase {
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.TokenService) private readonly tokenService: ITokenService,
        @inject(SESSION_TOKENS.SessionRepository) private readonly sessionRepository: ISessionRepository
    ) {}

    async execute(token?: string): Promise<ISocketAuthenticationResult> {
        if (!token) {
            return {
                state: 'guest',
                reason: 'missing_token'
            };
        }

        const decoded = this.tokenService.verify(token);
        if (!decoded?.id) {
            return {
                state: 'rejected',
                reason: 'invalid_token'
            };
        }

        const user = await this.userRepository.findById(decoded.id);

        if (!user) {
            return {
                state: 'rejected',
                reason: 'user_not_found'
            };
        }

        if (user.isPasswordChangedAfterTokenIssued(decoded.iat ?? 0)) {
            return {
                state: 'rejected',
                reason: 'password_changed'
            };
        }

        const session = await this.sessionRepository.findByToken(token);
        if (!session || !session.props.isActive) {
            return {
                state: 'rejected',
                reason: 'invalid_token'
            };
        }

        const socketUser: ISocketConnectionUser = {
            _id: user.id,
            firstName: user.props.firstName,
            lastName: user.props.lastName,
            email: user.props.email,
            avatar: user.props.avatar,
            teams: user.props.teams,
            role: user.props.role
        };

        return {
            state: 'authenticated',
            user: socketUser
        };
    }
}
