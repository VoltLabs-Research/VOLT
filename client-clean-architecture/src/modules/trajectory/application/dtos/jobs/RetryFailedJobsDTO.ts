export interface RetryFailedJobsInputDTO{
    trajectoryId: string;
};

export interface RetryFailedJobsOutputDTO{
    retried: number;
};
