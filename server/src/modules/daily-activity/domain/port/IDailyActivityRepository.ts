import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import DailyActivity, { ActivityType, DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';
import type { PersistedDailyActivity } from '@modules/daily-activity/domain/types/PersistedDailyActivity';

export interface IDailyActivityRepository extends IBaseRepository<DailyActivity, DailyActivityProps>{
    /**
     * Add daily activity.
     */
    addDailyActivity(
        teamId: string,
        userId: string,
        type: ActivityType,
        description: string
    ): Promise<void>;

    /**
     * Get activity for the specified team.
     */
    findActivityByTeamId(
        teamId: string,
        range: number
    ): Promise<PersistedDailyActivity[]>;

    updateOnlineMinutes(
        teamId: string,
        userId: string,
        date: Date,
        minutes: number
    ): Promise<void>;
};
