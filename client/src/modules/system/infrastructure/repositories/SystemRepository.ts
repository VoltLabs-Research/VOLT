import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ISystemRepository from '../../domain/ports/ISystemRepository';
import type { RBACConfig } from '../../domain/entities';

@injectable()
export default class SystemRepository extends BaseRepository implements ISystemRepository {
    constructor() {
        super('/system', { useRBAC: false });
    }

    async getRBACConfig(): Promise<RBACConfig> {
        const response = await this.client.get<ApiResponse<RBACConfig>>('/rbac');
        return this.unwrap(response);
    }
};
