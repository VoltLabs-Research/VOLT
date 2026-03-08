import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';

export interface ISystemMetricsRepository {
    save(metrics: SystemMetrics): Promise<void>;
    getLatest(): Promise<SystemMetrics | null>;
    getHistory(minutes?: number): Promise<SystemMetrics[]>;
    deleteExpired(): Promise<number>;
    listActiveClusterIds(cutoffTime: number): Promise<string[]>;
    getLatestByClusterId(clusterId: string): Promise<SystemMetrics | null>;
}
