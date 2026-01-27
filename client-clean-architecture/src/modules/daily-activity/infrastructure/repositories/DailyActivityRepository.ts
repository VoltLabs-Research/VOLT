import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { IDailyActivityRepository } from '../../domain/repositories/IDailyActivityRepository';
import type { ActivityData } from '../../domain/entities/DailyActivity';

export class DailyActivityRepository extends BaseRepository implements IDailyActivityRepository {
    constructor() {
        super('/daily-activity', { useRBAC: false });
    }

    async getTeamActivity(teamId: string, range: number = 365, userId?: string): Promise<ActivityData[]> {
        return this.get<ActivityData[]>(`/${teamId}/`, {
            query: { range, userId }
        });
    }
}

export const dailyActivityRepository = new DailyActivityRepository();
