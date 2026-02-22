export interface RetryTeamFailedJobsInputDTO {
    teamId: string;
    trajectoryId: string;
}

export interface RetryTeamFailedJobsOutputDTO {
    retriedFrames: number;
}
