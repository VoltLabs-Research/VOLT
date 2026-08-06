export type SystemStatus = 'Healthy' | 'Warning' | 'Critical';

export interface SystemMetrics {
    timestamp: Date;
    serverId: string;
    teamClusterId: string | null;
    cpu: {
        usage: number;
        cores: number;
        loadAvg: number[];
        coresUsage: number[];
    };
    memory: {
        total: number;
        used: number;
        free: number;
        usagePercent: number;
    };
    disk: {
        total: number;
        used: number;
        free: number;
        usagePercent: number;
    };
    network: {
        incoming: number;
        outgoing: number;
        total: number;
    };
    responseTime: number;
    responseTimes: {
        postgres: number;
        minio: number;
        self: number;
        average: number;
    };
    diskOperations: {
        read: number;
        write: number;
        speed: number;
        readIOPS?: number;
        writeIOPS?: number;
    };
    status: SystemStatus;
    uptime: number;
    postgres: {
        connections: number;
        queries: number;
        latency: number;
    } | null;
}
