import { ITokenService } from '@modules/auth/domain/port/ITokenService';
import { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';

export interface CreateSessionInput {
    userId: string;
    ip: string;
    userAgent: string;
    activityType: SessionActivityType;
}

@injectable()
export default class AuthSessionService {
    constructor(
        @inject(AUTH_TOKENS.TokenService)
        private readonly tokenService: ITokenService,
        @inject(SESSION_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository
    ){}

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
