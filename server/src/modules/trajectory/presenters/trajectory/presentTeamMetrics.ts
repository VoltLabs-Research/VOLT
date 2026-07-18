import type { TeamMetricsSnapshot } from '@modules/trajectory/contracts/trajectory';

export const presentTeamMetrics = (metrics: TeamMetricsSnapshot): TeamMetricsSnapshot => ({
    totals: metrics.totals,
    lastMonth: metrics.lastMonth,
    weekly: metrics.weekly
});
