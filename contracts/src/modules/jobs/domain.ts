// Wire response types for the jobs module — the shapes the client reads back
// from `data`. Mirrors the neutral `RemoveTeamJobsResult` / `RetryTeamJobsResult`
// maintenance results and the team-jobs realtime snapshot payload.

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

/** A single projected team job as broadcast to clients. */
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

/** The realtime team-jobs snapshot returned alongside a mutation. */
export interface TeamJobsSnapshot{
    revision: number;
    groups: TrajectoryJobGroup[];
}

export interface RemoveTeamRunningJobsResponse extends RemoveTeamJobsResult, TeamJobsSnapshot{}

export type RetryTeamFailedJobsResponse = RetryTeamJobsResult;
