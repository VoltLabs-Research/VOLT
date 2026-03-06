import Job from '@modules/jobs/domain/entities/Job';

export interface QueueOptions {
    queueName: string;
    workerPath: string;
    maxConcurrentJobs?: number;
    customStatusMapping?: Record<string, string>;
}

export interface IJobQueueService {
    /**
     * Add jobs to the queue
     */
    addJobs(jobs: Job[]): Promise<void>;

    /**
     * Get job status
     */
    getJobStatus(jobId: string): Promise<any | null>;

    /**
     * Get available worker count
     */
    getAvailableWorkerCount(): number;

    /**
     * Get mapped status
     */
    getMappedStatus(jobStatus: string): string;

    /**
     * Get queue name
     */
    getQueueName(): string;

    /**
     * Start the queue processing
     */
    start(): Promise<void>;

    /**
     * Stop the queue processing
     */
    stop(): Promise<void>;

    /**
     * Abort currently running jobs by id
     */
    abortRunningJobs(jobIds: string[]): Promise<number>;
}
