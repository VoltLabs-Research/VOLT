import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IDailyActivityRepository from '../../domain/ports/IDailyActivityRepository';
import type { GetTeamActivityParams } from '../../domain/ports/IDailyActivityRepository';
import type { DailyActivity } from '../../domain/entities';

@injectable()
export default class DailyActivityRepository extends BaseRepository implements IDailyActivityRepository {
    constructor() {
        super('/daily-activity', { useRBAC: true });
    }

    async getTeamActivity(params?: GetTeamActivityParams): Promise<DailyActivity[]> {
        const query = params?.range ? { range: params.range } : undefined;
        const response = await this.client.get<ApiResponse<DailyActivity[]>>('/', query);
        return this.unwrap(response);
    }
};
