import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import DailyActivity, { ActivityType, DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';

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
    ): Promise<DailyActivityProps[]>;

    updateOnlineMinutes(
        teamId: string,
        userId: string,
        date: Date,
        minutes: number
    ): Promise<void>;
};