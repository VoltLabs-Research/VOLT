import { injectable } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import si from 'systeminformation';
import type { DiskMetrics, DiskOperations } from '@modules/system/domain/value-objects/SystemMetrics';

const BYTES_PER_GB = 1024 ** 3;
const BYTES_PER_MB = 1024 * 1024;
const DISK_USAGE_CACHE_TTL_MS = 10_000;

@injectable()
export default class DiskMetricsCollector {
    private cachedUsage: {
        expiresAt: number;
        value: DiskMetrics;
    } | null = null;
    private pendingUsage: Promise<DiskMetrics> | null = null;

    async getUsage(): Promise<DiskMetrics> {
        const cachedUsage = this.cachedUsage;
        if (cachedUsage && cachedUsage.expiresAt > Date.now()) {
            return cachedUsage.value;
        }

        if (this.pendingUsage) {
            return this.pendingUsage;
        }

        this.pendingUsage = (async () => {
            try {
                const fileSystems = await si.fsSize();
                const rootFileSystem = fileSystems.find((fileSystem) => fileSystem.mount === '/') ?? fileSystems[0];

                if (!rootFileSystem) {
                    return { total: 0, used: 0, free: 0, usagePercent: 0 };
                }

                const metrics: DiskMetrics = {
                    total: Math.round((rootFileSystem.size / BYTES_PER_GB) * 100) / 100,
                    used: Math.round((rootFileSystem.used / BYTES_PER_GB) * 100) / 100,
                    free: Math.round((rootFileSystem.available / BYTES_PER_GB) * 100) / 100,
                    usagePercent: Math.round(rootFileSystem.use)
                };

                this.cachedUsage = {
                    expiresAt: Date.now() + DISK_USAGE_CACHE_TTL_MS,
                    value: metrics
                };

                return metrics;
            } catch (error: unknown) {
                logger.error(`Error getting disk metrics: ${error}`);
                return { total: 0, used: 0, free: 0, usagePercent: 0 };
            }
        })().finally(() => {
            this.pendingUsage = null;
        });

        return this.pendingUsage;
    }

    async getOperations(): Promise<DiskOperations> {
        try {
            const [fsStats, disksIO] = await Promise.all([
                si.fsStats(),
                si.disksIO()
            ]);

            const readIOPS = Math.round(disksIO.rIO_sec ?? 0);
            const writeIOPS = Math.round(disksIO.wIO_sec ?? 0);

            return {
                read: Math.round((((fsStats.rx_sec ?? 0) / BYTES_PER_MB) * 100)) / 100,
                write: Math.round((((fsStats.wx_sec ?? 0) / BYTES_PER_MB) * 100)) / 100,
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
