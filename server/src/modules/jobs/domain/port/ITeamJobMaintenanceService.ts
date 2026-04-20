export interface TeamClusterFailureDetail {
    teamClusterId: string;
    requestedJobs: number;
    affectedJobs: number;
    reason: 'command-failed' | 'partial-confirmation';
    message?: string;
};

export interface RemoveTeamJobsResult {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
};

export interface RetryTeamJobsResult {
    retriedFrames: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
};

export interface ITeamJobMaintenanceService {
    removeJobs(teamId: string, jobIds: string[]): Promise<RemoveTeamJobsResult>;
    retryJobs(teamId: string, jobIds: string[]): Promise<RetryTeamJobsResult>;
    removeJobsForAnalysis(teamId: string, analysisId: string): Promise<RemoveTeamJobsResult>;
    removeJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RemoveTeamJobsResult>;
    retryFailedJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RetryTeamJobsResult>;
};
