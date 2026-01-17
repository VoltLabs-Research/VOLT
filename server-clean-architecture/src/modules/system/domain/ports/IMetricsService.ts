export interface IMetricsService {
    collect(): Promise<SystemMetrics>;
    getLatestFromRedis(): Promise<SystemMetrics | null>;
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
    status: 'Healthy' | 'Warning' | 'Critical';
    uptime: number;
    mongodb: MongoDBMetrics | null;
}

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
