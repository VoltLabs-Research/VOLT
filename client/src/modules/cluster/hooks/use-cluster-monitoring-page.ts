import useClusterPageState from '@/modules/cluster/hooks/use-cluster-page-state';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import type { ClusterPageState } from '@/modules/cluster/hooks/use-cluster-page-state';

export interface ClusterMonitoringPageViewModel extends ClusterPageState {
    metrics: ClusterMetrics | null;
    history: ClusterMetrics[];
    metricsByClusterId: Record<string, ClusterMetrics>;
    hasClusters: boolean;
    isMetricsConnected: boolean;
};

const useClusterMonitoringPage = (): ClusterMonitoringPageViewModel => {
    const state = useClusterPageState();
    const metricsState = useClusterMetrics();
    const params = useParams<{ clusterId: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (!state.clusters.length) {
            return;
        }

        const routeClusterId = params.clusterId;
        if (!routeClusterId) {
            navigate(`/dashboard/clusters/${state.clusters[0]._id}`, {
                replace: true
            });
            return;
        }

        const targetCluster = state.clusters.find((cluster) => cluster._id === routeClusterId);
        if (!targetCluster) {
            navigate('/dashboard/clusters', {
                replace: true
            });
            return;
        }

        if (state.selectedClusterId !== routeClusterId) {
            state.setSelectedClusterId(routeClusterId);
        }
    }, [navigate, params.clusterId, state]);

    const metricsByClusterId = useMemo<Record<string, ClusterMetrics>>(() => {
        return metricsState.clusters.reduce<Record<string, ClusterMetrics>>((acc, cluster) => {
            const clusterId = resolveClusterMetricId(cluster);
            acc[clusterId] = cluster;
            return acc;
        }, {});
    }, [metricsState.clusters]);

    const metrics = useMemo(() => {
        if (!state.selectedCluster) {
            return null;
        }

        return metricsByClusterId[state.selectedCluster._id] ?? null;
    }, [metricsByClusterId, state.selectedCluster]);

    return {
        ...state,
        metrics,
        history: metricsState.history,
        metricsByClusterId,
        hasClusters: state.clusters.length > 0,
        isMetricsConnected: metricsState.isConnected
    };
};

export default useClusterMonitoringPage;
