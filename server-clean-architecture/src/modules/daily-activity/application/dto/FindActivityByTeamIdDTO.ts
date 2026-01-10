import { DailyActivityProps } from "../../domain/entities/DailyActivity";

export interface FindActivityByTeamIdInputDTO{
    teamId: string;
    range: number;
};

export interface FindActivityByTeamIdOutputDTO extends DailyActivityProps{};