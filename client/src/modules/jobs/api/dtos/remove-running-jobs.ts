export interface RemoveRunningJobsParams {
    trajectoryId: string;
};

export interface RemoveRunningJobsOutputDTO {
    deletedJobs: number;
    deletedAnalyses: number;
};
