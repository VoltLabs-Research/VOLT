import { formatNetworkSpeed } from './format-network';
import { getClusterCpuUsage } from './cluster-cpu-usage';
import { getClusterLiveMetricsStatus } from '@/modules/cluster/utils/cluster-live-metrics-status';
import { formatDuration } from '@/shared/utils/format';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';
import type { ClusterTransferJob } from '@volt/contracts/modules/cluster/domain';
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
    installedVersion: string | null;
    lastHeartbeatAt: Date | string | null;
    lastDisconnectAt: Date | string | null;
    daemonPort: number | null;
    cpu: number | null;
    memory: number | null;
    diskFree: number | null;
    diskUsagePercent: number | null;
    network: string;
    uptime: string;
    analysisCount: number | null;
    activeTransfers: ClusterTransferJob[];
}

interface TransformClusterToRowParams {
    teamCluster: TeamCluster;
    metrics: ClusterMetrics | null;
    isMetricsConnected: boolean;
}

const SECONDS_PER_MINUTE = 60;

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
        installedVersion: teamCluster.installedVersion,
        lastHeartbeatAt: teamCluster.lastHeartbeatAt,
        lastDisconnectAt: teamCluster.lastDisconnectAt,
        daemonPort: teamCluster.services.daemon.port,
        cpu: liveMetrics ? Math.round(getClusterCpuUsage(liveMetrics.cpu)) : null,
        memory: liveMetrics ? Math.round(liveMetrics.memory.usagePercent) : null,
        diskFree: liveMetrics ? Math.round(liveMetrics.disk.free) : null,
        diskUsagePercent: liveMetrics ? Math.round(liveMetrics.disk.usagePercent) : null,
        network: liveMetrics ? formatNetworkSpeed(liveMetrics.network.incoming + liveMetrics.network.outgoing) : '--',
        uptime: liveMetrics ? formatDuration(liveMetrics.uptime / SECONDS_PER_MINUTE) : '--',
        analysisCount: liveMetrics?.analysisCount ?? null,
        activeTransfers: teamCluster.activeTransfers ?? []
    };
};

export const transformClustersToRows = (clusters: TransformClusterToRowParams[]): ServerRow[] => {
    return clusters.map(transformClusterToRow);
};
