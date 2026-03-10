import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import type { MetricsSnapshot } from '../../../shared/contracts';

interface DiskIOSnapshot {
    reads: number;
    writes: number;
    readSectors: number;
    writeSectors: number;
    timestamp: number;
};

interface NetworkCounterSnapshot {
    receivedBytes: number;
    sentBytes: number;
    timestamp: number;
};

interface CpuTimeSnapshot {
    idle: number;
    total: number;
};

const execAsync = promisify(exec);
const BYTES_PER_MB = 1024 * 1024;
const SECTOR_SIZE = 512;
const PHYSICAL_DISK_PATTERN = /^(sd[a-z]|nvme\d+n\d+|vd[a-z]|hd[a-z])$/;
const PARTITION_SUFFIX_PATTERN = /\d+$/;
const NVME_DISK_PATTERN = /^nvme\d+n\d+$/;

export class MetricsService {
    private lastDiskIO: DiskIOSnapshot | null = null;
    private lastNetworkSnapshot: NetworkCounterSnapshot | null = null;
    private lastCpuTimes: CpuTimeSnapshot[] | null = null;
    private cloudLatencyMs: number | null = null;
    private cloudConnected = false;

    updateCloudLatency(latencyMs: number | null): void {
        this.cloudLatencyMs = latencyMs;
    }

    updateCloudConnectionState(isConnected: boolean): void {
        this.cloudConnected = isConnected;
    }

    async collectSnapshot(): Promise<MetricsSnapshot> {
        const cpuPerCoreUsagePercent = this.getCpuPerCoreUsagePercent();
        const cpuUsagePercent = cpuPerCoreUsagePercent.length > 0
            ? Math.round(cpuPerCoreUsagePercent.reduce((total, value) => total + value, 0) / cpuPerCoreUsagePercent.length)
            : 0;
        const memory = this.collectMemory();
        const disk = await this.collectDiskUsage();
        const diskOperations = await this.collectDiskOperations();
        const network = await this.collectNetwork();

        return {
            timestamp: new Date().toISOString(),
            hostname: os.hostname(),
            uptimeSeconds: os.uptime(),
            cpuUsagePercent,
            cpuLoadAverage: os.loadavg(),
            cpuPerCoreUsagePercent,
            memory,
            disk,
            diskOperations,
            network,
            cloudLatencyMs: this.cloudLatencyMs,
            connectedToCloud: this.cloudConnected
        };
    }

    private collectMemory() {
        const totalBytes = os.totalmem();
        const freeBytes = os.freemem();
        const usedBytes = totalBytes - freeBytes;
        return {
            totalBytes,
            freeBytes,
            usedBytes,
            usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0
        };
    }

    private async collectDiskUsage() {
        const { stdout } = await execAsync('df -B1 /');
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1] || '';
        const parts = lastLine.trim().split(/\s+/);

        const totalBytes = Number(parts[1] || 0);
        const usedBytes = Number(parts[2] || 0);
        const freeBytes = Number(parts[3] || 0);
        const usagePercent = Number((parts[4] || '0').replace('%', ''));

        return {
            totalBytes,
            freeBytes,
            usedBytes,
            usagePercent
        };
    }

    private async collectDiskOperations() {
        const data = await fs.readFile('/proc/diskstats', 'utf8');
        const lines = data.split('\n');
        const currentTime = Date.now();
        let totalReadOps = 0;
        let totalWriteOps = 0;
        let totalReadSectors = 0;
        let totalWriteSectors = 0;

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 14) {
                continue;
            }

            const deviceName = parts[2] || '';
            if (!PHYSICAL_DISK_PATTERN.test(deviceName)) {
                continue;
            }

            if (PARTITION_SUFFIX_PATTERN.test(deviceName) && !NVME_DISK_PATTERN.test(deviceName)) {
                continue;
            }

            totalReadOps += Number(parts[3] || 0);
            totalReadSectors += Number(parts[5] || 0);
            totalWriteOps += Number(parts[7] || 0);
            totalWriteSectors += Number(parts[9] || 0);
        }

        if (!this.lastDiskIO) {
            this.lastDiskIO = {
                reads: totalReadOps,
                writes: totalWriteOps,
                readSectors: totalReadSectors,
                writeSectors: totalWriteSectors,
                timestamp: currentTime
            };

            return {
                readMegabytesPerSecond: 0,
                writeMegabytesPerSecond: 0,
                readIOPS: 0,
                writeIOPS: 0,
                totalIOPS: 0
            };
        }

        const timeDiff = (currentTime - this.lastDiskIO.timestamp) / 1000;
        const readOpsDelta = Math.max(0, totalReadOps - this.lastDiskIO.reads);
        const writeOpsDelta = Math.max(0, totalWriteOps - this.lastDiskIO.writes);
        const readSectorsDelta = Math.max(0, totalReadSectors - this.lastDiskIO.readSectors);
        const writeSectorsDelta = Math.max(0, totalWriteSectors - this.lastDiskIO.writeSectors);

        this.lastDiskIO = {
            reads: totalReadOps,
            writes: totalWriteOps,
            readSectors: totalReadSectors,
            writeSectors: totalWriteSectors,
            timestamp: currentTime
        };

        if (timeDiff <= 0) {
            return {
                readMegabytesPerSecond: 0,
                writeMegabytesPerSecond: 0,
                readIOPS: 0,
                writeIOPS: 0,
                totalIOPS: 0
            };
        }

        const readIOPS = Math.round(readOpsDelta / timeDiff);
        const writeIOPS = Math.round(writeOpsDelta / timeDiff);
        return {
            readMegabytesPerSecond: Math.round((((readSectorsDelta * SECTOR_SIZE) / BYTES_PER_MB) / timeDiff) * 100) / 100,
            writeMegabytesPerSecond: Math.round((((writeSectorsDelta * SECTOR_SIZE) / BYTES_PER_MB) / timeDiff) * 100) / 100,
            readIOPS,
            writeIOPS,
            totalIOPS: readIOPS + writeIOPS
        };
    }

    private async collectNetwork() {
        const data = await fs.readFile('/proc/net/dev', 'utf8');
        const lines = data.split('\n');
        let receivedBytes = 0;
        let sentBytes = 0;

        for (let index = 2; index < lines.length; index += 1) {
            const line = lines[index]?.trim();
            if (!line) {
                continue;
            }

            const parts = line.split(/\s+/);
            const interfaceName = (parts[0] || '').replace(':', '');
            if (interfaceName === 'lo') {
                continue;
            }

            receivedBytes += Number(parts[1] || 0);
            sentBytes += Number(parts[9] || 0);
        }

        const currentTime = Date.now();
        if (!this.lastNetworkSnapshot) {
            this.lastNetworkSnapshot = {
                receivedBytes,
                sentBytes,
                timestamp: currentTime
            };

            return {
                incomingKilobytesPerSecond: 0,
                outgoingKilobytesPerSecond: 0,
                totalKilobytesPerSecond: 0,
                receivedBytes,
                sentBytes
            };
        }

        const timeDiff = (currentTime - this.lastNetworkSnapshot.timestamp) / 1000;
        const incomingKilobytesPerSecond = timeDiff > 0
            ? ((receivedBytes - this.lastNetworkSnapshot.receivedBytes) / 1024) / timeDiff
            : 0;
        const outgoingKilobytesPerSecond = timeDiff > 0
            ? ((sentBytes - this.lastNetworkSnapshot.sentBytes) / 1024) / timeDiff
            : 0;

        this.lastNetworkSnapshot = {
            receivedBytes,
            sentBytes,
            timestamp: currentTime
        };

        return {
            incomingKilobytesPerSecond: Math.round(incomingKilobytesPerSecond * 10) / 10,
            outgoingKilobytesPerSecond: Math.round(outgoingKilobytesPerSecond * 10) / 10,
            totalKilobytesPerSecond: Math.round((incomingKilobytesPerSecond + outgoingKilobytesPerSecond) * 10) / 10,
            receivedBytes,
            sentBytes
        };
    }

    private getCpuPerCoreUsagePercent(): number[] {
        const cpus = os.cpus();
        const currentTimes = cpus.map((cpu) => {
            const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
            return {
                idle: cpu.times.idle,
                total
            };
        });

        if (!this.lastCpuTimes) {
            this.lastCpuTimes = currentTimes;
            return cpus.map(() => 0);
        }

        const usage = currentTimes.map((current, index) => {
            const previous = this.lastCpuTimes?.[index];
            if (!previous) {
                return 0;
            }

            const idleDelta = current.idle - previous.idle;
            const totalDelta = current.total - previous.total;
            if (totalDelta <= 0) {
                return 0;
            }

            return Math.min(100, Math.max(0, Math.round(100 - ((100 * idleDelta) / totalDelta))));
        });

        this.lastCpuTimes = currentTimes;
        return usage;
    }
};
