import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import JwtTokenService from '@modules/auth/infrastructure/services/JwtTokenService';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import type { ISocketAuthenticationResult, ISocketConnectionUser } from '@modules/socket/domain/port/ISocketModule';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class AuthenticateSocketConnectionUseCase {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly tokenService: JwtTokenService,
        private readonly sessionRepository: SessionRepository
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
