export interface ClearTeamJobsHistoryInputDTO {
    teamId: string;
    trajectoryId: string;
}

export interface ClearTeamJobsHistoryOutputDTO {
    deletedJobs: number;
    deletedAnalyses: number;
}
