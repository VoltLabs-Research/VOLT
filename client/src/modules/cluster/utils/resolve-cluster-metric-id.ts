import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

export const resolveClusterMetricId = (metrics: ClusterMetrics): string => {
    return metrics.teamClusterId ?? metrics.clusterId;
};
