import { formatNetworkSpeed } from './format-network';
import { formatUptime } from './format-uptime';
import { ClusterStatus } from '../api/entities/cluster-metrics';
import type { ClusterMetrics } from '../api/entities/cluster-metrics';
import type { TeamCluster, TeamClusterStatus } from '../api/entities/team-cluster';

export interface ServerRow {
    id: string;
    name: string;
    status: ClusterStatus;
    statusClass: string;
    lifecycleStatus: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | string | null;
    lastDisconnectAt: Date | string | null;
    daemonPort: number | null;
    cpu: number;
    memory: number;
    diskFree: number;
    diskUsagePercent: number;
    network: string;
    uptime: string;
    analysisCount: number;
};

const STATUS_CLASS_MAP: Record<ClusterStatus, string> = {
    [ClusterStatus.Healthy]: 'server-table-status-healthy',
    [ClusterStatus.Warning]: 'server-table-status-warning',
    [ClusterStatus.Critical]: 'server-table-status-critical'
};

interface TransformClusterToRowParams {
    teamCluster: TeamCluster;
    metrics: ClusterMetrics | null;
};

const calculateCpuUsage = (metrics: ClusterMetrics | null): number => {
    if (!metrics) {
        return 0;
    }

    const { coresUsage, usage } = metrics.cpu;
    
    if(coresUsage?.length){
        const sum = coresUsage.reduce((acc, val) => acc + val, 0);
        return Math.round(sum / coresUsage.length);
    }
    
    return Math.round(usage);
};

const getStatusClass = (metrics: ClusterMetrics | null): string => {
    if (!metrics) {
        return 'server-table-status-warning';
    }

    return STATUS_CLASS_MAP[metrics.status];
};

const getMetricsStatus = (metrics: ClusterMetrics | null): ClusterStatus => {
    return metrics?.status ?? ClusterStatus.Warning;
};

export const transformClusterToRow = ({ teamCluster, metrics }: TransformClusterToRowParams): ServerRow => ({
    id: teamCluster._id,
    name: teamCluster.name,
    status: getMetricsStatus(metrics),
    statusClass: getStatusClass(metrics),
    lifecycleStatus: teamCluster.status,
    installedVersion: teamCluster.installedVersion,
    lastHeartbeatAt: teamCluster.lastHeartbeatAt,
    lastDisconnectAt: teamCluster.lastDisconnectAt,
    daemonPort: teamCluster.services.daemon.port,
    cpu: calculateCpuUsage(metrics),
    memory: Math.round(metrics?.memory.usagePercent ?? 0),
    diskFree: Math.round(metrics?.disk.free ?? 0),
    diskUsagePercent: Math.round(metrics?.disk.usagePercent ?? 0),
    network: metrics ? formatNetworkSpeed(metrics.network.incoming + metrics.network.outgoing) : '--',
    uptime: metrics ? formatUptime(metrics.uptime) : '--',
    analysisCount: metrics?.analysisCount ?? 0
});

export const transformClustersToRows = (clusters: TransformClusterToRowParams[]): ServerRow[] => {
    return clusters.map(transformClusterToRow);
};
