export interface ClearTeamJobsHistoryResult {
    deletedJobs: number;
    deletedAnalyses: number;
};

export interface RemoveTeamRunningJobsResult {
    deletedJobs: number;
    deletedAnalyses: number;
};

export interface RetryTeamFailedJobsResult {
    retriedFrames: number;
};

export interface ITeamJobMaintenanceService {
    clearHistory(teamId: string): Promise<ClearTeamJobsHistoryResult>;
    removeRunningJobs(teamId: string): Promise<RemoveTeamRunningJobsResult>;
    retryFailedJobs(teamId: string): Promise<RetryTeamFailedJobsResult>;
};
