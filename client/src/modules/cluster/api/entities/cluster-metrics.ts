export interface CpuMetrics {
    usage: number;
    cores: number;
    coresUsage: number[];
    loadAvg: number[];
};

export interface MemoryMetrics {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
};

export interface DiskMetrics {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
};

export interface NetworkMetrics {
    incoming: number;
    outgoing: number;
};

export interface ResponseTimes {
    mongodb: number;
    redis: number;
    minio: number;
    self: number;
};

export interface DatabaseMetrics {
    queries: number;
    connections: number;
    latency: number;
};

export interface DiskOperationsMetrics {
    read: number;
    write: number;
    speed: number;
};

export type ClusterStatus = 'Healthy' | 'Warning' | 'Critical';

export interface ClusterMetrics {
    timestamp?: Date | string;
    clusterId: string;
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
};

export interface ClusterHistoryMetric {
    timestamp?: ClusterMetrics['timestamp'];
    clusterId?: string;
    serverId?: ClusterMetrics['serverId'];
    status: ClusterMetrics['status'];
    cpu: ClusterMetrics['cpu'];
    memory: ClusterMetrics['memory'];
    disk: ClusterMetrics['disk'];
    network: ClusterMetrics['network'];
    responseTimes: ClusterMetrics['responseTimes'];
    mongodb?: ClusterMetrics['mongodb'] | null;
    diskOperations?: ClusterMetrics['diskOperations'];
    uptime: ClusterMetrics['uptime'];
    analysisCount?: ClusterMetrics['analysisCount'];
};

export interface IClusterMetricsSource {
    onMetricsAll(callback: (clusters: ClusterMetrics[]) => void): () => void;
    onMetricsHistory(callback: (history: ClusterHistoryMetric[]) => void): () => void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
    isConnected(): boolean;
    requestHistory(minutes?: number): Promise<void>;
};
