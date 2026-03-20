export interface RasterTriggerConfig extends Record<string, unknown> {
};

export interface RasterJobEnqueueResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
};

export interface IRasterJobEnqueuer {
    triggerRasterization(
        trajectoryId: string,
        teamId: string,
        config?: RasterTriggerConfig
    ): Promise<RasterJobEnqueueResult>;
};
