export interface CpuMetrics {
    usage: number;
    coresUsage: number[];
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

export interface ClusterMetrics {
    clusterId: string;
    cpu: CpuMetrics;
    memory: MemoryMetrics;
    disk: DiskMetrics;
    network: NetworkMetrics;
    analysisCount?: number;
    timestamp?: string;
}

export interface ClusterInfo {
    clusterId: string;
    analysisCount: number;
    status: 'active' | 'inactive';
}
