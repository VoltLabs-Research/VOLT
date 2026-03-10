export interface ClearTeamJobsHistoryInputDTO {
    teamId: string;
};

export interface ClearTeamJobsHistoryOutputDTO {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
};
