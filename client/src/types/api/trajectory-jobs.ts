export interface ClearHistoryResponse {
    message: string;
    deletedJobs: number;
    deletedAnalyses: number;
    trajectoryId: string;
}

export interface RemoveRunningJobsResponse {
    message: string;
    deletedJobs: number;
    deletedAnalyses: number;
    trajectoryId: string;
}

export interface RetryFailedJobsResponse {
    message: string;
    retriedFrames: number;
    analysesProcessed: number;
    trajectoryId: string;
}
