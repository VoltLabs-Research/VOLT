import JwtTokenService from '@modules/auth/infrastructure/services/JwtTokenService';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';

export interface CreateSessionInput {
    userId: string;
    ip: string;
    userAgent: string;
    activityType: SessionActivityType;
}

@Singleton()
export default class AuthSessionService {
    constructor(
        
        private readonly tokenService: JwtTokenService,
        
        private readonly sessionRepository: SessionRepository
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
