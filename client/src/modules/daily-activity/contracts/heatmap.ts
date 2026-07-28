import type { ActivityItem, DailyActivity } from '@volt/contracts/modules/daily-activity/domain';

export interface DailyActivityHeatmapDetailEntry extends ActivityItem{
    user: DailyActivity['user'];
    userId: string;
    userDisplayName: string;
    isCurrentUser: boolean;
}
