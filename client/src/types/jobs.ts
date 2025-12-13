export interface Job{
    jobId: string;
    trajectoryId: string;
    sessionId?: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'unknown';
    timestamp: string;
    progress?: number;
    [key: string]: any;
}

export interface JobStats{
    total: number;
    completed: number;
    totalAllTime: number;
    byStatus: Record<string, number>;
    hasActiveJobs: boolean;
    completionRate: number;
    isActiveSession: boolean;
}
