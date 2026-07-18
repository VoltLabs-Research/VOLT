import type { TeamMetricsSnapshot } from '@modules/trajectory/contracts/trajectory';

export type { TeamMetricsSnapshot } from '@modules/trajectory/contracts/trajectory';

export interface ITeamMetricsQueryService {
    getTeamMetrics(teamId: string): Promise<TeamMetricsSnapshot>;
};
