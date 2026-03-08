import type { PersistedDailyActivityDTO } from '@modules/daily-activity/application/dtos/PersistedDailyActivityDTO';

export interface FindActivityByTeamIdInputDTO {
    teamId: string;
    range: number;
}

export type FindActivityByTeamIdOutputDTO = PersistedDailyActivityDTO;
