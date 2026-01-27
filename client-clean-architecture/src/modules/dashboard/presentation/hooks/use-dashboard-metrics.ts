import { useEffect, useMemo, useState } from 'react';
import { useTrajectoryMetrics } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import { DashboardMetricsService, type TrajectoryMetrics } from '@/modules/dashboard/domain/services/DashboardMetricsService';

const useDashboardMetrics = (
    _teamId?: string,
    _trajectoryId?: string
) => {
    const { data: metrics, isLoading: loading, error: queryError } = useTrajectoryMetrics();
    const [rotationIndex, setRotationIndex] = useState(0);
    const metricsService = useMemo(() => new DashboardMetricsService(), []);

    const data = metrics as TrajectoryMetrics | undefined;

    useEffect(() => {
        const interval = setInterval(() => {
            setRotationIndex((prev) => prev + 1);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const error = useMemo(() => {
        if (!queryError) return null;
        return (queryError as any)?.message || 'Failed to load metrics';
    }, [queryError]);

    const cards = useMemo(() => {
        if (!data) return [];
        return metricsService.buildCards(data, rotationIndex);
    }, [data, rotationIndex, metricsService]);

    return { loading, error, data, cards };
};

export default useDashboardMetrics;
