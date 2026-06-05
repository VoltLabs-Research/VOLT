import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';

export interface ISystemMetricsRepository {
    save(metrics: SystemMetrics): Promise<void>;
    getHistoryByClusterId(clusterId: string, minutes?: number): Promise<SystemMetrics[]>;
    getLatestByClusterId(clusterId: string): Promise<SystemMetrics | null>;
}
