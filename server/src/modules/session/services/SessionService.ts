import { ErrorCodes } from '@core/constants/error-codes';
import SessionModel from '@modules/session/models/SessionModel';
import type { SessionDocument } from '@modules/session/models/SessionModel';
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

    return { browser, os, isMobile: MOBILE_PATTERN.test(userAgent) };
};

export default class SessionService{
    async getActiveSessions(userId: string, currentToken?: string): Promise<SessionView[]>{
        const docs = await SessionModel
            .find({ user: userId, isActive: true })
            .sort({ lastActivity: -1 });
        return docs.map((doc) => this.#toView(doc, currentToken));
    }

    async getLoginActivity(userId: string, limit = 20): Promise<{ activities: SessionView[] }>{
        const docs = await SessionModel
            .find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit);
        return { activities: docs.map((doc) => this.#toView(doc)) };
    }

    async revokeSession(sessionId: string, userId: string): Promise<void>{
        const session = await SessionModel.findById(sessionId);
        if(!session){
            throw ApplicationError.notFound(ErrorCodes.SESSION_NOT_FOUND, 'Session not found');
        }

        if(session.user?.toString() !== userId){
            throw ApplicationError.forbidden(
                ErrorCodes.SESSION_REVOKE_FAILED,
                'You do not have permission to revoke this session'
            );
        }

        session.isActive = false;
        await session.save();
    }

    async revokeAllSessions(userId: string, currentToken: string): Promise<{ revokedCount: number }>{
        const result = await SessionModel.updateMany(
            {
                user: userId,
                token: { $ne: currentToken },
                isActive: true
            },
            { isActive: false }
        );

        return { revokedCount: result.modifiedCount };
    }

    #toView(doc: SessionDocument, currentToken?: string): SessionView{
        const ua = parseUserAgent(doc.userAgent ?? '');
        return {
            _id: String(doc._id),
            user: doc.user ? String(doc.user) : null,
            token: null,
            userAgent: doc.userAgent,
            ip: doc.ip,
            isActive: doc.isActive,
            lastActivity: doc.lastActivity,
            action: doc.action,
            success: doc.success,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            isCurrent: Boolean(currentToken && doc.token === currentToken),
            browser: ua.browser,
            os: ua.os,
            isMobile: ua.isMobile
        };
    }
}
