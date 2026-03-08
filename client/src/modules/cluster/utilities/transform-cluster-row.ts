import { formatNetworkSpeed } from './format-network';
import { formatUptime } from './format-uptime';
import { ClusterStatus } from '../api/entities/cluster-metrics';
import type { ClusterMetrics } from '../api/entities/cluster-metrics';

export interface ServerRow {
    id: string;
    status: ClusterStatus;
    statusClass: string;
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

const calculateCpuUsage = (metrics: ClusterMetrics): number => {
    const { coresUsage, usage } = metrics.cpu;
    
    if(coresUsage?.length){
        const sum = coresUsage.reduce((acc, val) => acc + val, 0);
        return Math.round(sum / coresUsage.length);
    }
    
    return Math.round(usage);
};

export const transformClusterToRow = (metrics: ClusterMetrics): ServerRow => ({
    id: metrics.clusterId,
    status: metrics.status,
    statusClass: STATUS_CLASS_MAP[metrics.status],
    cpu: calculateCpuUsage(metrics),
    memory: Math.round(metrics.memory.usagePercent),
    diskFree: Math.round(metrics.disk.free),
    diskUsagePercent: Math.round(metrics.disk.usagePercent),
    network: formatNetworkSpeed(metrics.network.incoming + metrics.network.outgoing),
    uptime: formatUptime(metrics.uptime),
    analysisCount: metrics.analysisCount ?? 0
});

export const transformClustersToRows = (clusters: ClusterMetrics[]): ServerRow[] => 
    clusters.map(transformClusterToRow);
