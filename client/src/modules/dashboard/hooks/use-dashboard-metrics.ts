import { useDashboardMetricsQuery } from '@/modules/dashboard/hooks/queries';
import { abbreviateNumber, buildDelta } from '@/modules/dashboard/utils/delta';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { useEffect, useMemo } from 'react';
import type { DashboardMetrics } from '@volt/contracts/modules/dashboard/domain';
import type { DashboardCard } from '@/modules/dashboard/contracts/cards';
import type { DashboardRangeOption } from '@/modules/dashboard/contracts/range';

const readSeries = (data: DashboardMetrics, key: string): number[] => {
    const series = data.series[key];

    if (!Array.isArray(series)) {
        return [];
    }

    return series.filter((value): value is number => typeof value === 'number');
};

const buildCard = (
    data: DashboardMetrics,
    key: string,
    name: string,
    listingUrl?: string
): DashboardCard => {
    const total = data.totals[key] ?? 0;
    const series = readSeries(data, key);
    const change = data.lastMonth[key];

    return {
        key,
        name,
        listingUrl,
        count: abbreviateNumber(total),
        rawCount: total,
        delta: buildDelta(change?.current ?? 0, change?.previous ?? 0),
        windowTotal: series.reduce((sum, value) => sum + value, 0)
    };
};

const useDashboardMetrics = (teamId: string | undefined, range: DashboardRangeOption) => {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const metricsQuery = useDashboardMetricsQuery({
        days: range.days,
        bucket: range.bucket
    }, {
        enabled: !!teamId
    });

    useEffect(() => {
        if (metricsQuery.error) {
            checkAccessDeniedError(metricsQuery.error);
        }
    }, [metricsQuery.error, checkAccessDeniedError]);

    const cards = useMemo((): DashboardCard[] => {
        if (!metricsQuery.data) {
            return [];
        }

        const data = metricsQuery.data;

        return [
            buildCard(data, 'trajectories', 'Trajectories', '/dashboard/trajectories/list'),
            buildCard(data, 'analysis', 'Analyses', '/dashboard/analysis-configs/list')
        ];
    }, [metricsQuery.data]);

    return {
        loading: metricsQuery.isLoading,
        error: metricsQuery.error?.message ?? null,
        cards,
        accessDenied,
        accessDeniedMessage
    };
};

export default useDashboardMetrics;
