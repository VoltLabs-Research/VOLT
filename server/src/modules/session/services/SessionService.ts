import { Not } from 'typeorm';
import { ErrorCodes } from '@core/constants/error-codes';
import Session from '@modules/session/models/Session';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { parseUserAgent } from '@volt/contracts/modules/session/user-agent';

interface SessionView{
    _id: string;
    user: string | null;
    token: null;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: Date;
    action: string;
    success: boolean;
    createdAt: Date;
    updatedAt: Date;
    isCurrent: boolean;
    browser: string;
    os: string;
    isMobile: boolean;
}



export default class SessionService{
    async getActiveSessions(userId: string, currentToken?: string): Promise<SessionView[]>{
        const sessions = await Session.find({
            where: {
                user: userId,
                isActive: true
            },
            order: { lastActivity: 'DESC' }
        });
        return sessions.map((session) => this.#toView(session, currentToken));
    }

    async getLoginActivity(userId: string, limit = 20): Promise<{ activities: SessionView[] }>{
        const sessions = await Session.find({
            where: { user: userId },
            order: { createdAt: 'DESC' },
            take: limit
        });
        return { activities: sessions.map((session) => this.#toView(session)) };
    }

    async revokeSession(sessionId: string, userId: string): Promise<void>{
        const session = await Session.findOneBy({ id: sessionId });
        if(!session){
            throw ApplicationError.notFound(ErrorCodes.SESSION_NOT_FOUND, 'Session not found');
        }

        if(session.user !== userId){
            throw ApplicationError.forbidden(
                ErrorCodes.SESSION_REVOKE_FAILED,
                'You do not have permission to revoke this session'
            );
        }

        await Object.assign(session, { isActive: false }).save();
    }

    async revokeAllSessions(userId: string, currentToken: string): Promise<{ revokedCount: number }>{
        const result = await Session.update(
            {
                user: userId,
                token: Not(currentToken),
                isActive: true
            },
            { isActive: false }
        );

        return { revokedCount: result.affected ?? 0 };
    }

    #toView(entity: Session, currentToken?: string): SessionView{
        const ua = parseUserAgent(entity.userAgent ?? '');
        return {
            _id: entity.id,
            user: entity.user,
            token: null,
            userAgent: entity.userAgent,
            ip: entity.ip,
            isActive: entity.isActive,
            lastActivity: entity.lastActivity,
            action: entity.action,
            success: entity.success,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            isCurrent: Boolean(currentToken && entity.token === currentToken),
            browser: ua.browser,
            os: ua.os,
            isMobile: ua.isMobile
        };
    }
}
