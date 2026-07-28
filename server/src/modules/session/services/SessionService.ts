import { Not } from 'typeorm';
import { ErrorCodes } from '@core/constants/error-codes';
import Session from '@modules/session/models/Session';
import ApplicationError from '@shared/application/errors/ApplicationError';

interface ParsedUserAgent{
    browser: string;
    os: string;
    isMobile: boolean;
}

export interface SessionView{
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

const MOBILE_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;

const parseUserAgent = (userAgent: string): ParsedUserAgent => {
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (userAgent.includes('Firefox/')) browser = 'Firefox';
    else if (userAgent.includes('Edg/')) browser = 'Edge';
    else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) browser = 'Opera';
    else if (userAgent.includes('Chrome/') && userAgent.includes('Safari/')) browser = 'Chrome';
    else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) browser = 'Safari';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) os = 'macOS';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('CrOS')) os = 'ChromeOS';

    return {
        browser,
        os,
        isMobile: MOBILE_PATTERN.test(userAgent)
    };
};

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
