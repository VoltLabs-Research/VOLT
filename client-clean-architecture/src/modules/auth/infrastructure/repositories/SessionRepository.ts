import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { Session, LoginActivity, GetLoginActivityParams } from '../../domain/entities';

export class SessionRepository extends BaseRepository implements ISessionRepository {
    constructor() {
        super('/sessions');
    }

    async getAll(): Promise<Session[]> {
        return this.get<Session[]>('/');
    }

    async revoke(id: string): Promise<void> {
        await this.patch(`/${id}`, { isActive: false });
    }

    async revokeOthers(): Promise<void> {
        await this.delete('/all/others');
    }

    async getLoginActivity(params?: GetLoginActivityParams): Promise<LoginActivity[]> {
        return this.get<LoginActivity[]>('/activity', { query: params });
    }
}

export const sessionRepository = new SessionRepository();
