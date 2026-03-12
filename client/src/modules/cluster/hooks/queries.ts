import { buildKeys, createSocketQuery } from '@/shared/infrastructure/query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';
import type { QueryClient } from '@tanstack/react-query';
import type { ClusterHistoryMetric, ClusterMetrics } from '../api/entities/cluster-metrics';
import { MAX_HISTORY_POINTS } from '../utilities/history';
import { resolveClusterMetricId } from '../utilities/resolve-cluster-metric-id';

type ClusterQueryKeyMap = {
    metrics: void;
    history: string;
    historyLoaded: string;
};

export const CLUSTER_QUERY_KEYS = buildKeys<ClusterQueryKeyMap>('cluster');

registerPreservedQueryKey(CLUSTER_QUERY_KEYS.metrics()[0] as string);

export const clusterMetricsQuery = createSocketQuery<void, ClusterMetrics[]>(CLUSTER_QUERY_KEYS.metrics, { initialData: [] });
export const clusterHistoryQuery = createSocketQuery<string, ClusterMetrics[]>(CLUSTER_QUERY_KEYS.history, { initialData: [] });
export const clusterHistoryLoadedQuery = createSocketQuery<string, boolean>(CLUSTER_QUERY_KEYS.historyLoaded, { initialData: false });

const trimHistory = (history: ClusterMetrics[]): ClusterMetrics[] => {
    let nextHistory = history;

    if (history.length > MAX_HISTORY_POINTS) {
        nextHistory = history.slice(history.length - MAX_HISTORY_POINTS);
    }

    return nextHistory;
};

export const appendClusterHistoryMetric = (
    history: ClusterMetrics[],
    metric: ClusterMetrics
): ClusterMetrics[] => {
    const lastMetric = history[history.length - 1];
    const nextHistory = [...history];

    if (lastMetric?.timestamp && metric.timestamp) {
        const lastTimestamp = new Date(lastMetric.timestamp).getTime();
        const nextTimestamp = new Date(metric.timestamp).getTime();

        if (lastTimestamp === nextTimestamp && lastMetric.serverId === metric.serverId) {
            nextHistory[nextHistory.length - 1] = metric;
            return trimHistory(nextHistory);
        }
    }

    nextHistory.push(metric);
    return trimHistory(nextHistory);
};

export const setClusterMetricsQueryData = (
    _queryClient: QueryClient,
    clusters: ClusterMetrics[]
) => {
    clusterMetricsQuery.set(undefined, clusters);

    for (const cluster of clusters) {
        clusterHistoryQuery.update(resolveClusterMetricId(cluster), (previous = []) => {
            return appendClusterHistoryMetric(previous, cluster);
        });
    }
};

export const setClusterHistoryQueryData = (
    _queryClient: QueryClient,
    history: ClusterHistoryMetric[],
    clusterId: string
) => {
    clusterHistoryQuery.set(clusterId, trimHistory(history));
    clusterHistoryLoadedQuery.set(clusterId, true);
};

export const resetClusterHistoryQuery = (_queryClient: QueryClient, clusterId?: string) => {
    if (clusterId) {
        clusterHistoryQuery.set(clusterId, []);
        clusterHistoryLoadedQuery.set(clusterId, false);
        return;
    }

    _queryClient.removeQueries({ queryKey: ['cluster', 'history'] });
    _queryClient.removeQueries({ queryKey: ['cluster', 'historyLoaded'] });
};

export const resetClusterQueries = (_queryClient: QueryClient) => {
    clusterMetricsQuery.reset(undefined);
    _queryClient.removeQueries({ queryKey: ['cluster', 'history'] });
    _queryClient.removeQueries({ queryKey: ['cluster', 'historyLoaded'] });
};
