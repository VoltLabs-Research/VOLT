export interface CpuStats {
    cpu_usage: {
        total_usage: number;
        percpu_usage?: number[];
    };
    system_cpu_usage: number;
    online_cpus?: number;
}

export interface MemoryStats {
    usage: number;
    limit: number;
}

export interface NetworkStats {
    rx_bytes: number;
    tx_bytes: number;
}

export interface ContainerStats {
    cpu_stats: CpuStats;
    precpu_stats: CpuStats;
    memory_stats: MemoryStats;
    networks?: Record<string, NetworkStats>;
}

export interface ContainerStatsResponse {
    stats: ContainerStats;
    memoryMB: {
        used: number;
        total: number;
        free: number;
    };
    networkTotals: {
        rxBytes: number;
        txBytes: number;
    };
}
