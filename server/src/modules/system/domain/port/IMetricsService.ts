import type { ClusterSystemMetrics, SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';

export interface IMetricsService {
    collect(): Promise<SystemMetrics>;
    getLatest(): Promise<SystemMetrics | null>;
    getHistory(minutes?: number): Promise<SystemMetrics[]>;
    cleanExpiredHistory(): Promise<number>;
    getAllClustersMetrics(): Promise<ClusterSystemMetrics[]>;
    getClusterAnalysisCounts(): Promise<Record<string, number>>;
}
