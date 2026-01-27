import type { Session, LoginActivity, GetLoginActivityParams } from '../entities';

export interface ISessionRepository {
    getAll(): Promise<Session[]>;
    revoke(id: string): Promise<void>;
    revokeOthers(): Promise<void>;
    getLoginActivity(params?: GetLoginActivityParams): Promise<LoginActivity[]>;
}
