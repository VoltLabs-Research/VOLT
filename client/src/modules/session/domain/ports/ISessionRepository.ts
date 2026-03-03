import { Session, LoginActivity, RevokeAllResult } from '../entities/Session';

export default interface ISessionRepository {
    getActiveSessions(): Promise<Session[]>;
    getLoginActivity(limit?: number): Promise<LoginActivity>;
    revokeSession(sessionId: string): Promise<void>;
    revokeAllOtherSessions(): Promise<RevokeAllResult>;
}
