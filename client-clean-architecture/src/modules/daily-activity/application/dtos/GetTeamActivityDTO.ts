import type { DailyActivity } from '../../domain/entities';

export interface GetTeamActivityInputDTO {
    range?: number;
};

export type GetTeamActivityOutputDTO = DailyActivity[];
