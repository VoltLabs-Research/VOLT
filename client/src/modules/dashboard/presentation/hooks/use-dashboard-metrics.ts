import { useEffect, useMemo, useState } from 'react';
import useTrajectoryUseCases from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-use-cases';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { DashboardMetrics, DashboardCard } from '@/modules/dashboard/domain/entities';

const ROTATION_INTERVAL_MS = 5000;

const abbreviateNumber = (n: number): string => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}b`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}m`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(n);
};

const calculateYDomain = (values: number[]): { min: number; max: number } => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 1;
    return { min: min - padding, max: max + padding };
};

const buildCard = (
    data: DashboardMetrics,
    key: string,
    defaultName: string,
    defaultUrl?: string
): DashboardCard => {
    const meta = data.meta?.[key];
    const series = (data.weekly[key] as number[]) || [];
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

export const useDashboardMetrics = (teamId?: string) => {
    const { trajectoryRepository } = useTrajectoryUseCases();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const [data, setData] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rotationIndex, setRotationIndex] = useState(0);

    useEffect(() => {
        setLoading(true);
        setError(null);

        trajectoryRepository.getMetrics()
            .then((metrics: DashboardMetrics) => {
                setData(metrics);
            })
            .catch((err: unknown) => {
                if(checkRBACError(err)) return;
                const message = err instanceof Error ? err.message : 'Failed to load metrics';
                setError(message);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [teamId]);

    useEffect(() => {
        const interval = setInterval(() => {
            setRotationIndex((i) => i + 1);
        }, ROTATION_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const cards = useMemo((): DashboardCard[] => {
        if (!data) return [];

        const staticCards = [
            buildCard(data, 'trajectories', 'Trajectories', '/dashboard/trajectories/list'),
            buildCard(data, 'analysis', 'Analyses', '/dashboard/analysis-configs/list')
        ];

        const dynamicKeys = Object.keys(data.totals).filter(
            (k) => k !== 'trajectories' && k !== 'analysis'
        );

        if (dynamicKeys.length > 0) {
            const key = dynamicKeys[rotationIndex % dynamicKeys.length];
            staticCards.push(buildCard(data, key, key));
        }

        return staticCards;
    }, [data, rotationIndex]);

    return { loading, error, data, cards, accessDenied, accessDeniedMessage };
};

export default useDashboardMetrics;
