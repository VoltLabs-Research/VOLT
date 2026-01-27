import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { SystemStats, GetSystemStats, RBACConfig } from '@/shared/types/system';

export class SystemService extends BaseRepository {
    constructor() {
        super('/system');
    }

    async getStats(): Promise<SystemStats> {
        return (await this.get<GetSystemStats>('/stats')).stats;
    }

    async getRBACConfig(): Promise<RBACConfig> {
        return this.get<RBACConfig>('/rbac');
    }
}

export const systemService = new SystemService();
