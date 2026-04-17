import os from 'node:os';
import si from 'systeminformation';
import type { MetricsSnapshot } from '@/contracts';

interface CloudMetricsSnapshot {
    cloudLatencyMs: number | null;
    connectedToCloud: boolean;
};

interface DiskUsageSnapshot {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
};

const BYTES_PER_MB = 1024 * 1024;
const DISK_USAGE_CACHE_TTL_MS = 10_000;

export class MetricsService {
    private cachedDiskUsage: {
        expiresAt: number;
        value: DiskUsageSnapshot;
    } | null = null;

    async collectSnapshot(cloudMetrics?: CloudMetricsSnapshot): Promise<MetricsSnapshot> {
        const [currentLoad, memoryData, disk, fsStats, disksIO, networkStats] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            this.collectDiskUsage(),
            si.fsStats(),
            si.disksIO(),
            si.networkStats()
        ]);

        return {
            timestamp: new Date().toISOString(),
            hostname: os.hostname(),
            uptimeSeconds: os.uptime(),
            cpuUsagePercent: Math.round(currentLoad.currentLoad),
            cpuLoadAverage: os.loadavg(),
            cpuPerCoreUsagePercent: currentLoad.cpus.map((cpu) => Math.round(cpu.load)),
            memory: this.collectMemory(memoryData),
            disk,
            diskOperations: this.collectDiskOperations(fsStats, disksIO),
            network: this.collectNetwork(networkStats),
            cloudLatencyMs: cloudMetrics?.cloudLatencyMs ?? null,
            connectedToCloud: cloudMetrics?.connectedToCloud ?? false
        };
    }

    private collectMemory(memoryData: Awaited<ReturnType<typeof si.mem>>) {
        return {
            totalBytes: memoryData.total,
            freeBytes: memoryData.free,
            usedBytes: memoryData.used,
            usagePercent: memoryData.total > 0
                ? Math.round((memoryData.used / memoryData.total) * 100)
                : 0
        };
    }

    private async collectDiskUsage(): Promise<DiskUsageSnapshot> {
        const cachedDiskUsage = this.cachedDiskUsage;
        if (cachedDiskUsage && cachedDiskUsage.expiresAt > Date.now()) {
            return cachedDiskUsage.value;
        }

        const fileSystems = await si.fsSize();
        const rootFileSystem = fileSystems.find((fileSystem) => fileSystem.mount === '/') ?? fileSystems[0];
        const snapshot: DiskUsageSnapshot = rootFileSystem
            ? {
                totalBytes: rootFileSystem.size,
                freeBytes: rootFileSystem.available,
                usedBytes: rootFileSystem.used,
                usagePercent: Math.round(rootFileSystem.use)
            }
            : {
                totalBytes: 0,
                freeBytes: 0,
                usedBytes: 0,
                usagePercent: 0
            };

        this.cachedDiskUsage = {
            expiresAt: Date.now() + DISK_USAGE_CACHE_TTL_MS,
            value: snapshot
        };

        return snapshot;
    }

    private collectDiskOperations(
        fsStats: Awaited<ReturnType<typeof si.fsStats>>,
        disksIO: Awaited<ReturnType<typeof si.disksIO>>
    ) {
        const readIOPS = Math.round(disksIO.rIO_sec ?? 0);
        const writeIOPS = Math.round(disksIO.wIO_sec ?? 0);

        return {
            readMegabytesPerSecond: Math.round((((fsStats.rx_sec ?? 0) / BYTES_PER_MB) * 100)) / 100,
            writeMegabytesPerSecond: Math.round((((fsStats.wx_sec ?? 0) / BYTES_PER_MB) * 100)) / 100,
            readIOPS,
            writeIOPS,
            totalIOPS: readIOPS + writeIOPS
        };
    }

    private collectNetwork(networkStats: Awaited<ReturnType<typeof si.networkStats>>) {
        const activeInterfaces = networkStats.filter((stats) => stats.iface !== 'lo');
        const receivedBytes = activeInterfaces.reduce((total, stats) => total + stats.rx_bytes, 0);
        const sentBytes = activeInterfaces.reduce((total, stats) => total + stats.tx_bytes, 0);
        const incomingKilobytesPerSecond = activeInterfaces.reduce((total, stats) => total + stats.rx_sec, 0) / 1024;
        const outgoingKilobytesPerSecond = activeInterfaces.reduce((total, stats) => total + stats.tx_sec, 0) / 1024;

        return {
            incomingKilobytesPerSecond: Math.round(incomingKilobytesPerSecond * 10) / 10,
            outgoingKilobytesPerSecond: Math.round(outgoingKilobytesPerSecond * 10) / 10,
            totalKilobytesPerSecond: Math.round((incomingKilobytesPerSecond + outgoingKilobytesPerSecond) * 10) / 10,
            receivedBytes,
            sentBytes
        };
    }
};
