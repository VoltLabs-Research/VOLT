import type { CpuMetrics } from './CpuMetrics';
import type { MemoryMetrics } from './MemoryMetrics';
import type { DiskMetrics } from './DiskMetrics';
import type { NetworkMetrics } from './NetworkMetrics';
import type { ResponseTimes } from './ResponseTimes';
import type { DatabaseMetrics } from './DatabaseMetrics';
import type { DiskOperationsMetrics } from './DiskOperationsMetrics';

export type ClusterStatus = 'Healthy' | 'Warning' | 'Critical';

export interface ClusterMetrics {
    clusterId: string;
    serverId?: string;
    status: ClusterStatus;
    cpu: CpuMetrics;
    memory: MemoryMetrics;
    disk: DiskMetrics;
    network: NetworkMetrics;
    responseTimes: ResponseTimes;
    mongodb?: DatabaseMetrics;
    diskOperations?: DiskOperationsMetrics;
    uptime: number;
    analysisCount?: number;
};
