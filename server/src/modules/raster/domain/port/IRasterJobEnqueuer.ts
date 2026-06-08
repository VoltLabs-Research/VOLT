export interface RasterTriggerConfig {
}

export interface RasterJobEnqueueResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
    jobs?: Array<{
        jobId: string;
        teamId: string;
        queueType: string;
        name?: string;
        analysisId?: string;
        trajectoryId?: string;
        trajectoryName?: string;
        timestep?: number;
    }>;
}

export interface IRasterJobEnqueuer {
    triggerRasterization(
        trajectoryId: string,
        teamId: string,
        config?: RasterTriggerConfig
    ): Promise<RasterJobEnqueueResult>;
}
