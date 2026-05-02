import type { RasterTriggerConfig } from '@modules/raster/domain/port/IRasterJobEnqueuer';

export interface TriggerRasterizationInputDTO {
    trajectoryId: string;
    teamId: string;
    config?: RasterTriggerConfig;
}

export interface TriggerRasterizationOutputDTO {
    trajectoryId: string;
    triggered: boolean;
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
}
