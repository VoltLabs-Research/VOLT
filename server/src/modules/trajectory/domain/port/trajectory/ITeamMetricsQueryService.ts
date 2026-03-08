import type { TeamMetricsSnapshot } from '@modules/trajectory/domain/contracts/trajectory';

export type { TeamMetricMetaEntry, TeamMetricsSnapshot, TeamMetricTarget } from '@modules/trajectory/domain/contracts/trajectory';

export interface ITeamMetricsQueryService {
    getTeamMetrics(teamId: string): Promise<TeamMetricsSnapshot>;
};
