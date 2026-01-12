import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import DailyActivity, { ActivityType, DailyActivityProps } from "../entities/DailyActivity";

export interface IDailyActivityRepository extends IBaseRepository<DailyActivity, DailyActivityProps>{
    /**
     * Add daily activity.
     */
    addDailyActivity(
        teamId: string,
        userId: string,
        type: ActivityType,
        description: string
    ): Promise<void>;

    /**
     * Get activity for the specified team.
     */
    findActivityByTeamId(
        teamId: string, 
        range: number
    ): Promise<DailyActivityProps[]>;
};