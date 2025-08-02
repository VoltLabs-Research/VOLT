export interface BaseJob {
    jobId: string;
    priority?: number;
    retries?: number;
    maxRetries?: number;
    estimatedDurationMs?: number;
    name?: string;
    message?: string;
}

export interface WorkerPoolItem {
    worker: Worker;
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

export interface CircuitBreaker {
    failures: number;
    lastFailure: number;
    threshold: number;
    timeout: number;
    isOpen(): boolean;
    recordFailure(): void;
    reset(): void;
}