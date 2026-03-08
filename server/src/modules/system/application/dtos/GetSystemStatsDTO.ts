import { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';

export interface GetSystemStatsOutputDTO {
    stats: SystemMetrics;
}
