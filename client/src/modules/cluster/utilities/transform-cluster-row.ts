import { formatNetworkSpeed } from './format-network';
import { formatUptime } from './format-uptime';
import { getClusterLiveMetricsStatus } from '@/modules/cluster/utilities/cluster-live-metrics-status';
import type { ClusterMetrics } from '../api/entities/cluster-metrics';
import type { ClusterTransferJob } from '../api/entities/team-cluster-transfer';
import type { TeamCluster, TeamClusterRole, TeamClusterStatus } from '../api/entities/team-cluster';
import type { ClusterLiveMetricsLabel } from '@/modules/cluster/utilities/cluster-live-metrics-status';

export interface ServerRow {
    _id: string;
    teamCluster: TeamCluster;
    id: string;
    name: string;
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    status: ClusterLiveMetricsLabel;
    statusVariant: 'success' | 'warning' | 'danger' | 'inactive';
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
};

interface TransformClusterToRowParams {
    teamCluster: TeamCluster;
    metrics: ClusterMetrics | null;
    isMetricsConnected: boolean;
};

const calculateCpuUsage = (metrics: ClusterMetrics | null): number | null => {
    if (!metrics) {
        return null;
    }

    const { coresUsage, usage } = metrics.cpu;
    
    if (coresUsage?.length) {
        const sum = coresUsage.reduce((acc, val) => acc + val, 0);
        return Math.round(sum / coresUsage.length);
    }
    
    return Math.round(usage);
};

export const transformClusterToRow = ({ teamCluster, metrics, isMetricsConnected }: TransformClusterToRowParams): ServerRow => {
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
        cpu: calculateCpuUsage(liveMetrics),
        memory: liveMetrics ? Math.round(liveMetrics.memory.usagePercent) : null,
        diskFree: liveMetrics ? Math.round(liveMetrics.disk.free) : null,
        diskUsagePercent: liveMetrics ? Math.round(liveMetrics.disk.usagePercent) : null,
        network: liveMetrics ? formatNetworkSpeed(liveMetrics.network.incoming + liveMetrics.network.outgoing) : '--',
        uptime: liveMetrics ? formatUptime(liveMetrics.uptime) : '--',
        analysisCount: liveMetrics?.analysisCount ?? null,
        activeTransfers: teamCluster.activeTransfers ?? []
    };
};

export const transformClustersToRows = (clusters: TransformClusterToRowParams[]): ServerRow[] => {
    return clusters.map(transformClusterToRow);
};
