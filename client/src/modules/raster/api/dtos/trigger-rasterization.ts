export interface TriggerRasterizationParams {
    teamId: string;
    trajectoryId: string;
    config?: unknown;
};

export interface TriggerRasterizationResponse {
    trajectoryId: string;
    triggered: boolean;
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
};
