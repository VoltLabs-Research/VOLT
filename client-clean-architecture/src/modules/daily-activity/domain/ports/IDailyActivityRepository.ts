import type { DailyActivity } from '../entities';

export interface GetTeamActivityParams {
    range?: number;
};

export default interface IDailyActivityRepository {
    getTeamActivity(params?: GetTeamActivityParams): Promise<DailyActivity[]>;
};
