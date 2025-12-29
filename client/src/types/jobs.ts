export interface Job {
    jobId: string;
    trajectoryId: string;
    timestep: number;
    sessionId?: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'unknown';
    timestamp: string;
    progress?: number;
    queueType?: string;
    name?: string;
    message?: string;
    [key: string]: any;
}

export interface JobStats {
    total: number;
    completed: number;
    totalAllTime: number;
    byStatus: Record<string, number>;
    hasActiveJobs: boolean;
    completionRate: number;
    isActiveSession: boolean;
}

export interface FrameJobGroup {
    timestep: number;
    jobs: Job[];
    overallStatus: 'running' | 'completed' | 'failed' | 'partial';
}

export interface TrajectoryJobGroup {
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: 'running' | 'completed' | 'failed' | 'partial';
    completedCount: number;
    totalCount: number;
}



