import { SystemMetrics } from '@modules/system/domain/ports/IMetricsService';

export interface GetSystemStatsOutputDTO {
    stats: SystemMetrics;
}
