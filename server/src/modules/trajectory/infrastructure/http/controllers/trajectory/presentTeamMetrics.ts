import {
    GetTeamMetricsOutputDTO,
    GetTeamMetricsResultDTO
} from '@modules/trajectory/application/dtos/trajectory/GetTeamMetricsDTO';
import { TeamMetricTarget } from '@modules/trajectory/domain/port/ITeamMetricsQueryService';

const toListingUrl = (target?: TeamMetricTarget): string | undefined => {
    if (!target) {
        return undefined;
    }

    if (target.kind === 'plugins-dashboard') {
        return '/dashboard/plugins';
    }

    if (!target.trajectoryId || !target.pluginId || !target.exposureId) {
        return undefined;
    }

    return `/dashboard/trajectory/${target.trajectoryId}/plugins/${target.pluginId}/exposure/${target.exposureId}/listing`;
};

export const presentTeamMetrics = (metrics: GetTeamMetricsResultDTO): GetTeamMetricsOutputDTO => ({
    totals: metrics.totals,
    lastMonth: metrics.lastMonth,
    weekly: metrics.weekly,
    meta: metrics.meta
        ? Object.fromEntries(
            Object.entries(metrics.meta).map(([metricKey, meta]) => [
                metricKey,
                {
                    displayName: meta.displayName,
                    pluginName: meta.pluginName,
                    listingUrl: toListingUrl(meta.target)
                }
            ])
        )
        : undefined
});
