import type { PersistedDailyActivity } from '@modules/daily-activity/domain/types/PersistedDailyActivity';

export interface FindActivityByTeamIdInputDTO{
    teamId: string;
    range: number;
};

export type FindActivityByTeamIdOutputDTO = PersistedDailyActivity;
