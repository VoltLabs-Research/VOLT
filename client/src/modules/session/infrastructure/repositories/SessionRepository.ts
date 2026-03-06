import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ISessionRepository from '../../domain/port/ISessionRepository';
import { Session, LoginActivity, RevokeAllResult } from '../../domain/entities/Session';

@injectable()
export default class SessionRepository extends BaseRepository implements ISessionRepository {
    constructor() {
        super('/session', { useRBAC: false });
    }

    async getActiveSessions(): Promise<Session[]> {
        const response = await this.client.get<ApiResponse<Session[]>>('/');
        return this.unwrap(response);
    }

    async getLoginActivity(limit: number = 20): Promise<LoginActivity> {
        const response = await this.client.get<ApiResponse<LoginActivity>>('/activity', { limit });
        return this.unwrap(response);
    }

    async revokeSession(sessionId: string): Promise<void> {
        await this.client.patch<ApiResponse<void>>(`/${sessionId}`, {});
    }

    async revokeAllOtherSessions(): Promise<RevokeAllResult> {
        const response = await this.client.get<ApiResponse<RevokeAllResult>>('/all/others');
        return this.unwrap(response);
    }
}
