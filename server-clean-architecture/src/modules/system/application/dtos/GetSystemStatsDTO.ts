import { SystemMetrics } from '../../domain/ports/IMetricsService';

export interface GetSystemStatsOutputDTO {
    stats: SystemMetrics;
}
