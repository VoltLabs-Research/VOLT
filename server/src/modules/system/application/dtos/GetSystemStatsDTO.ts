import { SystemMetrics } from '@modules/system/domain/port/IMetricsService';

export interface GetSystemStatsOutputDTO {
    stats: SystemMetrics;
}
