export interface NetworkMetricSnapshot {
    bytes: { received: number; sent: number };
    timestamp: number;
}

export interface CpuTimeSnapshot {
    idle: number;
    total: number;
}

export interface DiskIOSnapshot {
    reads: number;
    writes: number;
    timestamp: number;
    readSectors: number;
    writeSectors: number;
}
