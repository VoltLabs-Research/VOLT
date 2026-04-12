import { GetTeamMetricsOutputDTO, GetTeamMetricsResultDTO } from '@modules/trajectory/application/dtos/trajectory/GetTeamMetricsDTO';

export const presentTeamMetrics = (metrics: GetTeamMetricsResultDTO): GetTeamMetricsOutputDTO => ({
    totals: metrics.totals,
    lastMonth: metrics.lastMonth,
    weekly: metrics.weekly
});
