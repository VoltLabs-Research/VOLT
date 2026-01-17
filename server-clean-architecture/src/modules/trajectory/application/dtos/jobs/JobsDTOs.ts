// Jobs DTOs
export interface CancelJobInputDTO {
    trajectoryId: string;
    jobId: string;
}

export interface CancelJobOutputDTO {
    message: string;
    jobId: string;
}

export interface RetryFailedJobsInputDTO {
    trajectoryId: string;
}

export interface RetryFailedJobsOutputDTO {
    message: string;
    retriedCount: number;
}

export interface GetJobStatusInputDTO {
    trajectoryId: string;
    jobId: string;
}

export interface GetJobStatusOutputDTO {
    job: {
        id: string;
        status: string;
        progress: number;
        error?: string;
    };
}
