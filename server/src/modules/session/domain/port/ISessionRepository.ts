import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type Session from '@modules/session/domain/entities/Session';
import type { SessionProps } from '@modules/session/domain/entities/Session';

export interface ISessionRepository extends IBaseRepository<Session, SessionProps> {
    findActiveByUserId(userId: string): Promise<Session[]>;
    findLoginActivity(userId: string, limit: number): Promise<Session[]>;
    deactivateAllExcept(userId: string, currentToken: string): Promise<number>;
    createFailedLogin(
        userId: string | null,
        userAgent: string,
        ip: string,
        reason: string
    ): Promise<Session>;
    findByToken(token: string): Promise<Session | null>;
}
