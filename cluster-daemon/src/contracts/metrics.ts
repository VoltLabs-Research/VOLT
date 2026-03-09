export interface MemorySnapshot {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
};

export interface DiskUsageSnapshot {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
};

export interface DiskOperationsSnapshot {
    readMegabytesPerSecond: number;
    writeMegabytesPerSecond: number;
    readIOPS: number;
    writeIOPS: number;
    totalIOPS: number;
};

export interface NetworkSnapshot {
    incomingKilobytesPerSecond: number;
    outgoingKilobytesPerSecond: number;
    totalKilobytesPerSecond: number;
    receivedBytes: number;
    sentBytes: number;
};

export interface MetricsSnapshot {
    timestamp: string;
    hostname: string;
    uptimeSeconds: number;
    cpuUsagePercent: number;
    cpuLoadAverage: number[];
    cpuPerCoreUsagePercent: number[];
    memory: MemorySnapshot;
    disk: DiskUsageSnapshot;
    diskOperations: DiskOperationsSnapshot;
    network: NetworkSnapshot;
    cloudLatencyMs: number | null;
    connectedToCloud: boolean;
};
