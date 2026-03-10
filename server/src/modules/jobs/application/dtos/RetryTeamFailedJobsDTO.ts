export interface RetryTeamFailedJobsInputDTO {
    teamId: string;
};

export interface RetryTeamFailedJobsOutputDTO {
    retriedFrames: number;
    affectedClusters: number;
};
