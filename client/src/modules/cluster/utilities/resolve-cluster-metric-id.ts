import type { ClusterMetrics } from '@/modules/cluster/api/types/cluster-metrics';

export const resolveClusterMetricId = (metrics: ClusterMetrics): string => {
    return metrics.teamClusterId ?? metrics.clusterId;
};
