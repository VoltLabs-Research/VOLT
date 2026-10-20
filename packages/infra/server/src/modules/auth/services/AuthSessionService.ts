import jwtTokenService from '@modules/auth/services/JwtTokenService';
import Session from '@modules/session/models/Session';
import { type SessionActivityType } from '@volt/contracts/modules/session/domain';

interface CreateSessionInput{
    userId: string;
    ip: string;
    userAgent: string;
    activityType: SessionActivityType;
}

class AuthSessionService{
    async createSessionWithToken(input: CreateSessionInput): Promise<string>{
        const token = jwtTokenService.sign(input.userId);

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

export default new AuthSessionService();
