import { buildKeys, createSocketQuery, queryClient } from '@/shared/query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';
import type { ClusterHistoryMetric, ClusterMetrics } from '@volt/contracts/modules/cluster/domain';
import { resolveClusterMetricId } from '../utils/resolve-cluster-metric-id';

const MAX_HISTORY_POINTS = 60;

type ClusterQueryKeyMap = {
    metrics: void;
    history: string;
    historyLoaded: string;
};

const CLUSTER_QUERY_KEYS = buildKeys<ClusterQueryKeyMap>('cluster');

registerPreservedQueryKey(CLUSTER_QUERY_KEYS.metrics()[0] as string);

export const clusterMetricsQuery = createSocketQuery<void, ClusterMetrics[]>(CLUSTER_QUERY_KEYS.metrics, { initialData: [] });
export const clusterHistoryQuery = createSocketQuery<string, ClusterMetrics[]>(CLUSTER_QUERY_KEYS.history, { initialData: [] });
export const clusterHistoryLoadedQuery = createSocketQuery<string, boolean>(CLUSTER_QUERY_KEYS.historyLoaded, { initialData: false });

const trimHistory = (history: ClusterMetrics[]): ClusterMetrics[] => {
    return history.length > MAX_HISTORY_POINTS
        ? history.slice(-MAX_HISTORY_POINTS)
        : history;
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

const appendClusterHistoryMetric = (
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
    history: ClusterHistoryMetric[],
    clusterId: string
) => {
    const nextHistory = trimHistory(history);
    const latestMetric = nextHistory[nextHistory.length - 1];

    clusterHistoryQuery.set(clusterId, nextHistory);
    clusterHistoryLoadedQuery.set(clusterId, true);

    if (latestMetric) {
        setClusterMetricsQueryData([latestMetric]);
    }
};

export const resetClusterHistoryQuery = () => {
    queryClient.removeQueries({ queryKey: ['cluster', 'history'] });
    queryClient.removeQueries({ queryKey: ['cluster', 'historyLoaded'] });
};

