import { useDashboardMetricsQuery } from '@/modules/dashboard/hooks/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect, useMemo } from 'react';
import type { DashboardCard, DashboardMetrics } from '@/modules/dashboard/api/entities/dashboard';

interface DashboardYDomain {
    min: number;
    max: number;
};

const abbreviateNumber = (value: number): string => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
    return String(value);
};

const calculateYDomain = (values: number[]): DashboardYDomain => {
    if (values.length === 0) {
        return {
            min: 0,
            max: 1
        };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 1;
    return {
        min: min - padding,
        max: max + padding
    };
};

const buildCard = (
    data: DashboardMetrics,
    key: string,
    defaultName: string,
    defaultUrl?: string
): DashboardCard => {
    let series: number[] = [];
    const weeklySeries = data.weekly[key];
    if (Array.isArray(weeklySeries) && weeklySeries.every((value) => typeof value === 'number')) {
        series = weeklySeries;
    }

    const total = data.totals[key] || 0;

    return {
        key,
        name: defaultName,
        listingUrl: defaultUrl,
        count: abbreviateNumber(total),
        rawCount: total,
        lastMonthStatus: data.lastMonth[key] || 0,
        series,
        labels: data.weekly.labels,
        yDomain: calculateYDomain(series)
    };
};

/**
 * @param teamId - Used only as a gate for the `enabled` option. The query fires only
 * when a team is selected. The actual team scoping is handled server-side via RBAC.
 */
export const useDashboardMetrics = (teamId?: string) => {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const metricsQuery = useDashboardMetricsQuery(undefined, {
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

    const errorMessage = metricsQuery.error instanceof Error ? metricsQuery.error.message : null;

    return {
        loading: metricsQuery.isLoading,
        error: errorMessage,
        data: metricsQuery.data || null,
        cards,
        accessDenied,
        accessDeniedMessage
    };
};

export default useDashboardMetrics;
