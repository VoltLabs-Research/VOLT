

export interface TeamClusterFailureDetail{
    teamClusterId: string;
    requestedJobs: number;
    affectedJobs: number;
    reason: 'command-failed' | 'partial-confirmation';
    message?: string;
}

export interface RemoveTeamJobsResult{
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
}

export interface RetryTeamJobsResult{
    retriedFrames: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
}

export interface TeamJobSnapshotView{
    jobId: string;
    name?: string;
    teamId: string;
    teamClusterId?: string;
    queueType: string;
    status: string;
    message?: string;
    error?: string;
    timestamp?: string;
    createdAt?: string;
    updatedAt?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    revision?: number;
    [key: string]: unknown;
}

export interface FrameJobGroup{
    timestep: number;
    jobs: TeamJobSnapshotView[];
    overallStatus: string;
}

export interface TrajectoryJobGroup{
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: string;
    completedCount: number;
    totalCount: number;
}

export interface TeamJobsSnapshot{
    revision: number;
    groups: TrajectoryJobGroup[];
}

export interface RemoveTeamRunningJobsResponse extends RemoveTeamJobsResult, TeamJobsSnapshot{}

export type RetryTeamFailedJobsResponse = RetryTeamJobsResult;
