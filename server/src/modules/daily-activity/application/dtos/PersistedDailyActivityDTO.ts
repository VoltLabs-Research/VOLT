import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';

export interface DailyActivityUserSummaryDTO {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
}

export type PersistedDailyActivityDTO = PersistedOutput<Omit<DailyActivityProps, 'user'>> & {
    user: string | DailyActivityUserSummaryDTO;
};
