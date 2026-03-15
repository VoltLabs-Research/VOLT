export interface TriggerRasterizationInputDTO {
    trajectoryId: string;
    teamId: string;
    config?: unknown;
};

export interface TriggerRasterizationOutputDTO {
    trajectoryId: string;
    triggered: boolean;
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
};
