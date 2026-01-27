import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { IApiTrackerRepository } from '../../domain/repositories/IApiTrackerRepository';
import type { ApiTrackerRequest, GetApiTrackerParams } from '../../domain/entities';

export class ApiTrackerRepository extends BaseRepository implements IApiTrackerRepository {
    constructor() {
        super('/api-tracker', { useRBAC: false });
    }

    async getAll(params?: GetApiTrackerParams): Promise<ApiTrackerRequest[]> {
        return this.get<ApiTrackerRequest[]>('/', { query: params });
    }
}

export const apiTrackerRepository = new ApiTrackerRepository();
