export enum JobStatus{
    Queued = 'queued',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Retrying = 'retrying',
    QueuedAfterFailure = 'queued_after_failure'
}

export enum FrameJobGroupStatus{
    Queued = 'queued',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Partial = 'partial'
}

type JobMetadataPrimitive = boolean | number | string | null | undefined;

export interface JobMetadata{
    timestep?: number;
    [key: string]: JobMetadataPrimitive | JobMetadata;
}

type JobMetadataValue = JobMetadataPrimitive | JobMetadata;

export interface Job{
    jobId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    metadata?: JobMetadata;
    sessionId?: string;
    status: JobStatus;
    timestamp: string;
    progress?: number;
    queueType?: string;
    name?: string;
    message?: string;
    analysisId?: string;
    processingTimeMs?: number;
    error?: string;
    revision?: number;
    [key: string]: JobMetadataValue;
}

export interface FrameJobGroup{
    timestep: number;
    jobs: Job[];
    overallStatus: FrameJobGroupStatus;
}

export interface TrajectoryJobGroup{
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: FrameJobGroupStatus;
    completedCount: number;
    totalCount: number;
}

export interface TeamJobsSnapshot{
    revision: number;
    groups: TrajectoryJobGroup[];
}

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

export interface RemoveTeamRunningJobsResponse extends RemoveTeamJobsResult, TeamJobsSnapshot{}

export type RetryTeamFailedJobsResponse = RetryTeamJobsResult;
