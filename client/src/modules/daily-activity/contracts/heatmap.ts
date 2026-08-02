import type { ActivityItem } from '@volt/contracts/modules/daily-activity/domain';

export interface DailyActivityHeatmapDetailEntry extends ActivityItem{
    userDisplayName: string;
}
