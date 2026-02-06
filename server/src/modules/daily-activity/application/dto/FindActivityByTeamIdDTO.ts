import { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';

export interface FindActivityByTeamIdInputDTO{
    teamId: string;
    range: number;
};

export interface FindActivityByTeamIdOutputDTO extends DailyActivityProps{};