import JwtTokenService from '@modules/auth/services/JwtTokenService';
import Session from '@modules/session/models/Session';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';

export interface CreateSessionInput{
    userId: string;
    ip: string;
    userAgent: string;
    activityType: SessionActivityType;
}

export default class AuthSessionService{
    #tokenService = new JwtTokenService();

    async createSessionWithToken(input: CreateSessionInput): Promise<string>{
        const token = this.#tokenService.sign(input.userId);

        await Session.create({
            user: input.userId,
            token,
            userAgent: input.userAgent,
            ip: input.ip,
            isActive: true,
            lastActivity: new Date(),
            action: input.activityType,
            success: true
        }).save();

        return token;
    }
}
