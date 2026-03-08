import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { injectable } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import type { DiskMetrics, DiskOperations } from '@modules/system/domain/value-objects/SystemMetrics';
import type { DiskIOCheck } from './metricsTypes';

const execPromise = promisify(exec);
const BYTES_PER_GB = 1024 ** 3;
const SECTOR_SIZE = 512;
const BYTES_PER_MB = 1024 * 1024;

const PHYSICAL_DISK_PATTERN = /^(sd[a-z]|nvme\d+n\d+|vd[a-z]|hd[a-z])$/;
const PARTITION_SUFFIX_PATTERN = /\d+$/;
const NVME_DISK_PATTERN = /^nvme\d+n\d+$/;

@injectable()
export default class DiskMetricsCollector {
    private lastDiskIO: DiskIOCheck | null = null;

    async getUsage(): Promise<DiskMetrics> {
        try {
            const { stdout } = await execPromise('df -B1 / | tail -1');
            const parts = stdout.trim().split(/\s+/);

            const total = parseInt(parts[1]) || 0;
            const used = parseInt(parts[2]) || 0;
            const available = parseInt(parts[3]) || 0;
            const usagePercent = parseInt(parts[4]?.replace('%', '')) || 0;

            return {
                total: Math.round((total / BYTES_PER_GB) * 100) / 100,
                used: Math.round((used / BYTES_PER_GB) * 100) / 100,
                free: Math.round((available / BYTES_PER_GB) * 100) / 100,
                usagePercent
            };
        } catch (error: unknown) {
            logger.error(`Error getting disk metrics: ${error}`);
            return { total: 0, used: 0, free: 0, usagePercent: 0 };
        }
    }

    async getOperations(): Promise<DiskOperations> {
        try {
            const data = await fs.readFile('/proc/diskstats', 'utf8');
            const lines = data.split('\n');
            const currentTime = Date.now();

            let totalReadOps = 0;
            let totalWriteOps = 0;
            let totalReadSectors = 0;
            let totalWriteSectors = 0;

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 14) continue;

                const deviceName = parts[2];
                if (!PHYSICAL_DISK_PATTERN.test(deviceName)) continue;
                if (PARTITION_SUFFIX_PATTERN.test(deviceName) && !NVME_DISK_PATTERN.test(deviceName)) continue;

                totalReadOps += parseInt(parts[3]) || 0;
                totalReadSectors += parseInt(parts[5]) || 0;
                totalWriteOps += parseInt(parts[7]) || 0;
                totalWriteSectors += parseInt(parts[9]) || 0;
            }

            if (!this.lastDiskIO) {
                this.lastDiskIO = {
                    reads: totalReadOps,
                    writes: totalWriteOps,
                    readSectors: totalReadSectors,
                    writeSectors: totalWriteSectors,
                    timestamp: currentTime
                };
                return { read: 0, write: 0, speed: 0 };
            }

            const timeDiff = (currentTime - this.lastDiskIO.timestamp) / 1000;
            if (timeDiff <= 0) {
                return { read: 0, write: 0, speed: 0 };
            }

            const readOpsDelta = Math.max(0, totalReadOps - this.lastDiskIO.reads);
            const writeOpsDelta = Math.max(0, totalWriteOps - this.lastDiskIO.writes);
            const readIOPS = Math.round(readOpsDelta / timeDiff);
            const writeIOPS = Math.round(writeOpsDelta / timeDiff);

            const readSectorsDelta = Math.max(0, totalReadSectors - this.lastDiskIO.readSectors);
            const writeSectorsDelta = Math.max(0, totalWriteSectors - this.lastDiskIO.writeSectors);

            const readMBps = ((readSectorsDelta * SECTOR_SIZE) / BYTES_PER_MB) / timeDiff;
            const writeMBps = ((writeSectorsDelta * SECTOR_SIZE) / BYTES_PER_MB) / timeDiff;

            this.lastDiskIO = {
                reads: totalReadOps,
                writes: totalWriteOps,
                readSectors: totalReadSectors,
                writeSectors: totalWriteSectors,
                timestamp: currentTime
            };

            return {
                read: Math.round(readMBps * 100) / 100,
                write: Math.round(writeMBps * 100) / 100,
                speed: readIOPS + writeIOPS,
                readIOPS,
                writeIOPS
            };
        } catch (error: unknown) {
            logger.error(`Error reading disk operations: ${error}`);
            return { read: 0, write: 0, speed: 0, readIOPS: 0, writeIOPS: 0 };
        }
    }
}
