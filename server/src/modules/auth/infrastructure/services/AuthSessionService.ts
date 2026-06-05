import type { IAuthSessionService, CreateSessionInput } from '@modules/auth/domain/port/IAuthSessionService';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { ITokenService } from '@modules/auth/domain/port/ITokenService';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton(AUTH_TOKENS.AuthSessionService)
export default class AuthSessionService implements IAuthSessionService {
    constructor(
        @inject(AUTH_TOKENS.TokenService)
        private readonly tokenService: ITokenService,
        @inject(SESSION_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository
    ) {}

    async createSessionWithToken(input: CreateSessionInput): Promise<string> {
        const token = this.tokenService.sign(input.userId);

        await this.sessionRepository.create({
            user: input.userId,
            token,
            userAgent: input.userAgent,
            ip: input.ip,
            isActive: true,
            lastActivity: new Date(),
            action: input.activityType,
            success: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return token;
    }
}
