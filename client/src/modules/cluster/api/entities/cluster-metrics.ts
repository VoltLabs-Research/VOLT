import type { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';

export interface CpuMetrics {
    usage: number;
    cores: number;
    coresUsage: number[];
    loadAvg: number[];
}

export interface MemoryMetrics {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
}

export interface DiskMetrics {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
}

export interface NetworkMetrics {
    incoming: number;
    outgoing: number;
}

export interface ResponseTimes {
    mongodb: number;
    redis: number;
    minio: number;
    self: number;
}

export interface DatabaseMetrics {
    queries: number;
    connections: number;
    latency: number;
}

export interface DiskOperationsMetrics {
    read: number;
    write: number;
    speed: number;
}

export enum ClusterStatus {
    Healthy = 'Healthy',
    Warning = 'Warning',
    Critical = 'Critical'
}

export interface ClusterMetrics {
    timestamp?: Date | string;
    clusterId: string;
    teamClusterId?: string;
    teamClusterName?: string;
    teamClusterStatus?: TeamClusterStatus;
    serverId?: string;
    status: ClusterStatus;
    cpu: CpuMetrics;
    memory: MemoryMetrics;
    disk: DiskMetrics;
    network: NetworkMetrics;
    responseTimes: ResponseTimes;
    mongodb?: DatabaseMetrics;
    diskOperations?: DiskOperationsMetrics;
    uptime: number;
    analysisCount?: number;
}

export interface ClusterHistoryMetric extends ClusterMetrics {};
