import useClusterPageState from '@/modules/cluster/hooks/use-cluster-page-state';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import { resolveSelectedClusterId } from '@/modules/cluster/utilities/resolve-selected-cluster-id';
import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import type { ClusterPageState } from '@/modules/cluster/hooks/use-cluster-page-state';
export interface ClusterMonitoringPageViewModel extends ClusterPageState {
    metrics: ClusterMetrics | null;
    history: ClusterMetrics[];
    metricsByClusterId: Record<string, ClusterMetrics>;
    hasClusters: boolean;
    isMetricsConnected: boolean;
}

const useClusterMonitoringPage = (): ClusterMonitoringPageViewModel => {
    const state = useClusterPageState();
    const params = useParams<{ clusterId: string }>();
    const navigate = useNavigate();
    const resolvedRouteClusterId = useMemo(() => {
        return resolveSelectedClusterId(params.clusterId ?? null, state.clusters);
    }, [params.clusterId, state.clusters]);
    const metricsState = useClusterMetrics({ clusterId: resolvedRouteClusterId });
    const requestHistory = metricsState.requestHistory;

    useEffect(() => {
        if (!metricsState.isConnected || !resolvedRouteClusterId) {
            return;
        }

        requestHistory(5, resolvedRouteClusterId);
    }, [metricsState.isConnected, requestHistory, resolvedRouteClusterId]);

    useEffect(() => {
        if (!resolvedRouteClusterId) {
            return;
        }

        if (params.clusterId !== resolvedRouteClusterId) {
            navigate(`/dashboard/clusters/${resolvedRouteClusterId}`, {
                replace: true
            });
            return;
        }

        if (state.selectedClusterId !== resolvedRouteClusterId) {
            state.setSelectedClusterId(resolvedRouteClusterId);
        }
    }, [navigate, params.clusterId, resolvedRouteClusterId, state.selectedClusterId, state.setSelectedClusterId]);

    const metricsByClusterId = useMemo<Record<string, ClusterMetrics>>(() => {
        return metricsState.clusters.reduce<Record<string, ClusterMetrics>>((acc, cluster) => {
            const clusterId = resolveClusterMetricId(cluster);
            acc[clusterId] = cluster;
            return acc;
        }, {});
    }, [metricsState.clusters]);

    const selectedCluster = useMemo(() => {
        if (!resolvedRouteClusterId) {
            return null;
        }

        return state.clusters.find((cluster) => cluster._id === resolvedRouteClusterId) ?? null;
    }, [resolvedRouteClusterId, state.clusters]);

    const metrics = useMemo(() => {
        if (!metricsState.isConnected || !resolvedRouteClusterId) {
            return null;
        }

        return metricsByClusterId[resolvedRouteClusterId] ?? null;
    }, [metricsByClusterId, metricsState.isConnected, resolvedRouteClusterId]);

    return {
        ...state,
        selectedCluster,
        selectedClusterId: resolvedRouteClusterId,
        metrics,
        history: metricsState.history,
        metricsByClusterId,
        hasClusters: state.clusters.length > 0,
        isMetricsConnected: metricsState.isConnected
    };
};

export default useClusterMonitoringPage;
