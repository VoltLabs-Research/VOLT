export interface TeamClusterFailureDetail {
    teamClusterId: string;
    requestedJobs: number;
    affectedJobs: number;
    reason: 'command-failed' | 'partial-confirmation';
    message?: string;
};

export interface ClearTeamJobsHistoryResult {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
};

export interface RemoveTeamRunningJobsResult {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
};

export interface RetryTeamFailedJobsResult {
    retriedFrames: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
};

export interface ITeamJobMaintenanceService {
    clearHistory(teamId: string): Promise<ClearTeamJobsHistoryResult>;
    removeRunningJobs(teamId: string): Promise<RemoveTeamRunningJobsResult>;
    retryFailedJobs(teamId: string, jobIds?: string[]): Promise<RetryTeamFailedJobsResult>;
};
