import { Singleton } from '@shared/infrastructure/di/decorators';
import os from 'os';

import type { MemoryMetrics } from '@modules/system/domain/value-objects/SystemMetrics';

const BYTES_PER_GB = 1024 ** 3;

@Singleton()
export default class MemoryMetricsCollector {
    collect(): MemoryMetrics {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usagePercent = (used / total) * 100;

        return {
            total: total / BYTES_PER_GB,
            used: used / BYTES_PER_GB,
            free: free / BYTES_PER_GB,
            usagePercent: Math.round(usagePercent)
        };
    }
}
