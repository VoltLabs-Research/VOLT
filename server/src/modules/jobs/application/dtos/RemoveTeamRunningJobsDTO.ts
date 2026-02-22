export interface RemoveTeamRunningJobsInputDTO {
    teamId: string;
    trajectoryId: string;
}

export interface RemoveTeamRunningJobsOutputDTO {
    deletedJobs: number;
    deletedAnalyses: number;
}
