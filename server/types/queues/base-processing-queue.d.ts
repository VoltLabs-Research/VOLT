import { Worker } from 'worker_threads';

export interface BaseJob {
    jobId: string;
    timestep: number;
    trajectoryId: string;
    trajectoryName: string;
    teamId: string;
    retries?: number;
    maxRetries?: number;
    estimatedDurationMs?: number;
    name?: string;
    sessionId?: string;
    message?: string;
}

export interface WorkerPoolItem {
    worker: Worker | any;
    isIdle: boolean;
    currentJobId?: string;
    startTime?: number;
    jobCount: number;
    lastUsed: number;
    timeouts: Set<NodeJS.Timeout>;
}

export interface QueueOptions {
    queueName: string;
    workerPath: string;
    processor?: (job: any, postMessage?: (msg: any) => void) => Promise<any>;
    useWorkerThreads?: boolean;
    maxConcurrentJobs?: number;
    cpuLoadThreshold?: number;
    ramLoadThreshold?: number;
    workerIdleTimeout?: number;
    jobTimeout?: number;
    enableMetrics?: boolean;
    healthCheckInterval?: number;
    useStreamingAdd?: boolean;
    gracefulShutdownTimeout?: number;
}

export interface QueueMetrics {
    totalJobsProcessed: number;
    totalJobsFailed: number;
    averageProcessingTimeMs: number;
    peakMemoryUsageMB: number;
    workerRestarts: number;
    lastHealthCheck: string;
}

