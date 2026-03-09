import { useDashboardMetricsQuery } from '@/modules/dashboard/hooks/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect, useMemo, useState } from 'react';
import type { DashboardCard, DashboardMetrics } from '@/modules/dashboard/api/entities/dashboard';

interface DashboardYDomain {
    min: number;
    max: number;
};

const ROTATION_INTERVAL_MS = 5000;

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
    const meta = data.meta?.[key];
    let series: number[] = [];
    const weeklySeries = data.weekly[key];
    if (Array.isArray(weeklySeries) && weeklySeries.every((value) => typeof value === 'number')) {
        series = weeklySeries;
    }

    const total = data.totals[key] || 0;

    return {
        key,
        name: meta?.displayName || defaultName,
        listingUrl: meta?.listingUrl || defaultUrl,
        pluginName: meta?.pluginName,
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
    const [rotationIndex, setRotationIndex] = useState(0);

    const metricsQuery = useDashboardMetricsQuery(undefined, {
        enabled: !!teamId
    });

    useEffect(() => {
        if (metricsQuery.error) {
            checkAccessDeniedError(metricsQuery.error);
        }
    }, [metricsQuery.error, checkAccessDeniedError]);

    useEffect(() => {
        const interval = setInterval(() => {
            setRotationIndex((currentIndex) => currentIndex + 1);
        }, ROTATION_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const cards = useMemo((): DashboardCard[] => {
        if (!metricsQuery.data) {
            return [];
        }

        const data = metricsQuery.data;
        const staticCards = [
            buildCard(data, 'trajectories', 'Trajectories', '/dashboard/trajectories/list'),
            buildCard(data, 'analysis', 'Analyses', '/dashboard/analysis-configs/list')
        ];

        const dynamicKeys = Object.keys(data.totals).filter(
            (key) => key !== 'trajectories' && key !== 'analysis'
        );

        if (dynamicKeys.length > 0) {
            const key = dynamicKeys[rotationIndex % dynamicKeys.length];
            staticCards.push(buildCard(data, key, key));
        }

        return staticCards;
    }, [metricsQuery.data, rotationIndex]);

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
