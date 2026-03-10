export interface ClearTeamJobsHistoryResult {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
};

export interface RemoveTeamRunningJobsResult {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
};

export interface RetryTeamFailedJobsResult {
    retriedFrames: number;
    affectedClusters: number;
};

export interface ITeamJobMaintenanceService {
    clearHistory(teamId: string): Promise<ClearTeamJobsHistoryResult>;
    removeRunningJobs(teamId: string): Promise<RemoveTeamRunningJobsResult>;
    retryFailedJobs(teamId: string, jobIds?: string[]): Promise<RetryTeamFailedJobsResult>;
};
