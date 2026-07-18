import JwtTokenService from '@modules/auth/services/JwtTokenService';
import SessionModel, { SessionActivityType } from '@modules/session/models/SessionModel';

export interface CreateSessionInput {
    userId: string;
    ip: string;
    userAgent: string;
    activityType: SessionActivityType;
}

export default class AuthSessionService {
    #tokenService = new JwtTokenService();

    async createSessionWithToken(input: CreateSessionInput): Promise<string> {
        const token = this.#tokenService.sign(input.userId);

        await SessionModel.create({
            user: input.userId,
            token,
            userAgent: input.userAgent,
            ip: input.ip,
            isActive: true,
            lastActivity: new Date(),
            action: input.activityType,
            success: true
        });

        return token;
    }
}
