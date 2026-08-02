import useClusterPageState from '@/modules/cluster/hooks/use-cluster-page-state';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveSelectedClusterId } from '@/modules/cluster/utils/resolve-selected-cluster-id';
import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const useClusterMonitoringPage = () => {
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

    const selectedCluster = useMemo(() => {
        if (!resolvedRouteClusterId) {
            return null;
        }

        return state.clusters.find((cluster) => cluster._id === resolvedRouteClusterId) ?? null;
    }, [resolvedRouteClusterId, state.clusters]);

    return {
        ...state,
        selectedCluster,
        selectedClusterId: resolvedRouteClusterId,
        metrics: metricsState.isConnected && resolvedRouteClusterId ? metricsState.metrics : null,
        history: metricsState.history,
        hasClusters: state.clusters.length > 0,
        isMetricsConnected: metricsState.isConnected
    };
};

export default useClusterMonitoringPage;
