import { getClusterCpuUsage } from './cluster-cpu-usage';
import { getClusterLiveMetricsStatus } from '@/modules/cluster/utils/cluster-live-metrics-status';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';
import type { TeamCluster, TeamClusterRole, TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import type { ClusterLiveMetricsLabel, ClusterLiveMetricsVariant } from '@/modules/cluster/utils/cluster-live-metrics-status';

export interface ServerRow {
    _id: string;
    teamCluster: TeamCluster;
    id: string;
    name: string;
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    status: ClusterLiveMetricsLabel;
    statusVariant: ClusterLiveMetricsVariant;
    lifecycleStatus: TeamClusterStatus;
    lastHeartbeatAt: Date | string | null;
    cpu: number | null;
    memory: number | null;
    diskFree: number | null;
    diskUsagePercent: number | null;
}

interface TransformClusterToRowParams {
    teamCluster: TeamCluster;
    metrics: ClusterMetrics | null;
    isMetricsConnected: boolean;
}

const transformClusterToRow = ({ teamCluster, metrics, isMetricsConnected }: TransformClusterToRowParams): ServerRow => {
    const liveMetrics = isMetricsConnected ? metrics : null;
    const liveMetricsStatus = getClusterLiveMetricsStatus({
        metrics: liveMetrics,
        isMetricsConnected
    });

    return {
        _id: teamCluster._id,
        teamCluster,
        id: teamCluster._id,
        name: teamCluster.name,
        desiredRole: teamCluster.roleConfig.desiredRole,
        effectiveRole: teamCluster.roleConfig.effectiveRole,
        status: liveMetricsStatus.label,
        statusVariant: liveMetricsStatus.variant,
        lifecycleStatus: teamCluster.status,
        lastHeartbeatAt: teamCluster.lastHeartbeatAt,
        cpu: liveMetrics ? Math.round(getClusterCpuUsage(liveMetrics.cpu)) : null,
        memory: liveMetrics ? Math.round(liveMetrics.memory.usagePercent) : null,
        diskFree: liveMetrics ? Math.round(liveMetrics.disk.free) : null,
        diskUsagePercent: liveMetrics ? Math.round(liveMetrics.disk.usagePercent) : null
    };
};

export const transformClustersToRows = (clusters: TransformClusterToRowParams[]): ServerRow[] => {
    return clusters.map(transformClusterToRow);
};
