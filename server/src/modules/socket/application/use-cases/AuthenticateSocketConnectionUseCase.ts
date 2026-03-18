import { inject, injectable } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { ITokenService } from '@modules/auth/domain/port/ITokenService';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ISocketAuthenticationResult, ISocketConnectionUser } from '@modules/socket/domain/port/ISocketModule';

@injectable()
export default class AuthenticateSocketConnectionUseCase {
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.TokenService)
        private readonly tokenService: ITokenService
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
