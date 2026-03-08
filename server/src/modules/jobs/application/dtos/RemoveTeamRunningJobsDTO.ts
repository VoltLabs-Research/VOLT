export interface RemoveTeamRunningJobsInputDTO {
    teamId: string;
};

export interface RemoveTeamRunningJobsOutputDTO {
    deletedJobs: number;
    deletedAnalyses: number;
};
