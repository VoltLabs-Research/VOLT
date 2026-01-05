export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'unknown';
export type FrameJobGroupStatus = 'queued' | 'running' | 'completed' | 'failed' | 'partial';

export interface Job {
    jobId: string;
    trajectoryId: string;
    timestep: number;
    sessionId?: string;
    status: JobStatus;
    timestamp: string;
    progress?: number;
    queueType?: string;
    name?: string;
    message?: string;
    [key: string]: any;
}

export interface FrameJobGroup {
    timestep: number;
    jobs: Job[];
    overallStatus: FrameJobGroupStatus;
}

export interface TrajectoryJobGroup {
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: FrameJobGroupStatus;
    completedCount: number;
    totalCount: number;
}