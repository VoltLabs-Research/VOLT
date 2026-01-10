import { ActivityType } from "../../domain/entities/DailyActivity";

export interface AddDailyActivityInputDTO{
    teamId: string;
    userId: string;
    type: ActivityType;
    description: string;
};