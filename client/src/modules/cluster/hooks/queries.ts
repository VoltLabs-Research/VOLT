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

const mergeClusterMetrics = (
    previous: ClusterMetrics[],
    updates: ClusterMetrics[]
): ClusterMetrics[] => {
    const metricsByClusterId = new Map<string, ClusterMetrics>();

    for (const metric of previous) {
        metricsByClusterId.set(resolveClusterMetricId(metric), metric);
    }

    for (const metric of updates) {
        metricsByClusterId.set(resolveClusterMetricId(metric), metric);
    }

    return [...metricsByClusterId.values()];
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
    clusterMetricsQuery.update(undefined, (previous = []) => {
        return mergeClusterMetrics(previous, clusters);
    });

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
    const nextHistory = trimHistory(history);
    const latestMetric = nextHistory[nextHistory.length - 1];

    clusterHistoryQuery.set(clusterId, nextHistory);
    clusterHistoryLoadedQuery.set(clusterId, true);

    if (latestMetric) {
        setClusterMetricsQueryData(_queryClient, [latestMetric]);
    }
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
