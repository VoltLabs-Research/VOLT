import { inject, injectable } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { ITokenService } from '@modules/auth/domain/port/ITokenService';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ISocketConnectionUser } from '@modules/socket/domain/port/ISocketModule';

@injectable()
export default class AuthenticateSocketConnectionUseCase {
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.TokenService)
        private readonly tokenService: ITokenService
    ) {}

    async execute(token?: string): Promise<ISocketConnectionUser | null> {
        if (!token) {
            return null;
        }

        const decoded = this.tokenService.verify(token);
        const user = await this.userRepository.findById(decoded?.id || '');

        if (!user) {
            return null;
        }

        return {
            _id: user.id,
            firstName: user.props.firstName,
            lastName: user.props.lastName,
            email: user.props.email,
            avatar: user.props.avatar,
            teams: user.props.teams
        };
    }
}
