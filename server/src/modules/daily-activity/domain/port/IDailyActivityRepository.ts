import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import type DailyActivity from '@modules/daily-activity/domain/entities/DailyActivity';
import type { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';

export interface DailyActivityUserSummary {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
}

export type DailyActivityRecord = PersistedOutput<Omit<DailyActivityProps, 'user'>> & {
    user: string | DailyActivityUserSummary;
};

export interface FindActivityByTeamIdOptions {
    userId?: string;
}

export interface IDailyActivityRepository extends IBaseRepository<DailyActivity, DailyActivityProps> {
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
        range: number,
        options?: FindActivityByTeamIdOptions
    ): Promise<DailyActivityRecord[]>;

    updateOnlineMinutes(
        teamId: string,
        userId: string,
        date: Date,
        minutes: number
    ): Promise<void>;
}
