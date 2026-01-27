import type { ActivityData } from '../entities/DailyActivity';

export interface IDailyActivityRepository {
    getTeamActivity(teamId: string, range?: number, userId?: string): Promise<ActivityData[]>;
}
