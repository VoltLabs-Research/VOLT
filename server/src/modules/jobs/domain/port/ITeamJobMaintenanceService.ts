export interface TeamClusterFailureDetail {
    teamClusterId: string;
    requestedJobs: number;
    affectedJobs: number;
    reason: 'command-failed' | 'partial-confirmation';
    message?: string;
}

export interface RemoveTeamJobsResult {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
}

export interface RetryTeamJobsResult {
    retriedFrames: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
}

export interface TrajectoryDeletedCleanupInput {
    teamId: string;
    trajectoryId: string;
    storageClusterId?: string;
    analysisIds?: string[];
    analysisComputeClusterIds?: string[];
}

export interface AnalysisDeletedCleanupInput {
    analysisId: string;
    teamId: string;
    computeClusterId?: string;
}

export interface ITeamJobMaintenanceService {
    retryJobs(teamId: string, jobIds: string[]): Promise<RetryTeamJobsResult>;
    removeJobsForAnalysis(teamId: string, analysisId: string): Promise<RemoveTeamJobsResult>;
    removeJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RemoveTeamJobsResult>;
    retryFailedJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RetryTeamJobsResult>;
    cleanupDeletedTrajectory(input: TrajectoryDeletedCleanupInput): Promise<void>;
    cleanupDeletedAnalysis(input: AnalysisDeletedCleanupInput): Promise<void>;
}
