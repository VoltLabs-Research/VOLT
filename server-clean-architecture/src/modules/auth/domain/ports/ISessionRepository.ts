import { IBaseRepository } from "../../../../shared/domain/IBaseRepository";
import Session, { SessionProps } from "../entities/Session";

export interface ISessionRepository extends IBaseRepository<Session, SessionProps>{
    /**
     * Find session by token.
     */
    findByToken(token: string): Promise<Session | null>;

    /**
     * Find all active sessions for a user.
     */
    findActiveByUserId(userId: string): Promise<Session[]>;

    /**
     * Find login activity history for a user.
     */
    findLoginActivity(
        userId: string,
        limit: number
    ): Promise<Session[]>;

    /**
     * Deactivate session by token.
     */
    deactivateByToken(token: string): Promise<void>;

    /**
     * Deactivate all sessions for user except current token.
     */
    deactivateAllExcept(
        userId: string,
        currentToken: string
    ): Promise<number>;

    /**
     * Deactivate all sessions for user.
     */
    deactivateAll(userId: string): Promise<number>;

    /**
     * Create a failed login record.
     */
    createFailedLogin(
        userId: string | null,
        userAgent: string,
        ip: string,
        reason: string
    ): Promise<Session>;

    /**
     * Update last activity timestamp
     */
    updateActivity(sessionId: string): Promise<void>;
};