import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';

export interface AddDailyActivityInputDTO{
    teamId: string;
    userId: string;
    type: ActivityType;
    description: string;
};