import type { ActivityType } from '@volt/contracts/modules/daily-activity/domain';

export interface DailyActivityEntryProps{
    type: ActivityType;
    createdAt: Date;
    description: string;
}
