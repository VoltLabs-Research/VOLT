export type SystemStatus = 'Healthy' | 'Warning' | 'Critical';

export interface CPUMetrics {
    usage: number;
    cores: number;
    loadAvg: number[];
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
    total: number;
}

export interface ResponseTimes {
    mongodb: number;
    redis: number;
    minio: number;
    self: number;
    average: number;
}

export interface DiskOperations {
    read: number;
    write: number;
    speed: number;
    readIOPS?: number;
    writeIOPS?: number;
}

export interface MongoDBMetrics {
    connections: number;
    queries: number;
    latency: number;
}

export interface SystemMetrics {
    timestamp: Date;
    serverId: string;
    cpu: CPUMetrics;
    memory: MemoryMetrics;
    disk: DiskMetrics;
    network: NetworkMetrics;
    responseTime: number;
    responseTimes: ResponseTimes;
    diskOperations: DiskOperations;
    status: SystemStatus;
    uptime: number;
    mongodb: MongoDBMetrics | null;
}

export interface ClusterSystemMetrics extends SystemMetrics {
    clusterId: string;
    analysisCount: number;
}

type SerializedSystemMetrics = Omit<SystemMetrics, 'timestamp'> & {
    timestamp: Date | string;
};

export const serializeSystemMetrics = (metrics: SystemMetrics): string => JSON.stringify(metrics);

export const hydrateSystemMetrics = (metrics: SerializedSystemMetrics): SystemMetrics => ({
    ...metrics,
    timestamp: metrics.timestamp instanceof Date ? metrics.timestamp : new Date(metrics.timestamp)
});

export const deserializeSystemMetrics = (payload: string): SystemMetrics => {
    return hydrateSystemMetrics(JSON.parse(payload) as SerializedSystemMetrics);
};
