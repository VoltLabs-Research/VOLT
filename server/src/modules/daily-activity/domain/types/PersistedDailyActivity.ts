import type { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';

export interface PersistedDailyActivity extends DailyActivityProps {
    _id: string;
}
