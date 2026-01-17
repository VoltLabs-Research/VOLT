import Job from "../entities/Job";

export interface IJobRepository {
    /**
     * Add jobs to the queue.
     */
    addToQueue(
        queueKey: string,
        jobs: string[]
    ): Promise<void>;

    /**
     * Get job from queue.
     */
    getFromQueue(
        queueKey: string,
        processingKey: string,
        timeoutSeconds: number
    ): Promise<string | null>;

    /**
     * Get multiple jobs from queue.
     */
    getMultipleFromQueue(
        queueKey: string,
        processingKey: string,
        count: number
    ): Promise<string[]>;

    /**
     * Move job from processing to queue.
     */
    moveToQueue(
        queueKey: string,
        processingKey: string,
        rawData: string
    ): Promise<void>;

    /**
     * Remove job from processing.
     */
    removeFromProcessing(
        processingKey: string,
        rawData: string
    ): Promise<void>;

    /**
     * Get queue length.
     */
    getQueueLength(queueKey: string): Promise<number>;

    /**
     * Get processing length.
     */
    getProcessingLength(processingKey: string): Promise<number>;

    /**
     * Set job status.
     */
    setJobStatus(
        statusKey: string,
        data: any,
        ttlSeconds: number
    ): Promise<void>;

    /**
     * Get job status
     */
    getJobStatus(statusKey: string): Promise<any | null>;

    /**
     * Delete job status
     */
    deleteJobStatus(statusKey: string): Promise<void>;

    /**
     * Increment retry counter
     */
    incrementRetryCounter(
        retryKey: string,
        ttlSeconds: number
    ): Promise<number>;

    /**
     * Delete retry counter
     */
    deleteRetryCounter(retryKey: string): Promise<void>;

    /**
     * Add job to team jobs set
     */
    addToTeamJobs(
        teamId: string,
        jobId: string
    ): Promise<void>;

    /**
     * Get all job IDs for a team
     */
    getTeamJobIds(teamId: string): Promise<string[]>;

    /**
     * Execute Lua script
     */
    evalScript(
        script: string,
        numKeys: number,
        ...args: (string | number)[]
    ): Promise<any>;

    /**
     * Get all jobs from list
     */
    getListRange(
        key: string,
        start: number,
        end: number
    ): Promise<string[]>;

    /**
     * Check if key exists
     */
    exists(key: string): Promise<number>;

    /**
     * Set key with expiry
     */
    setWithExpiry(
        key: string,
        value: string,
        expirySeconds: number
    ): Promise<void>;

    /**
     * Delete key
     */
    delete(key: string): Promise<void>;

    /**
     * Get value
     */
    get(key: string): Promise<string | null>;

    /**
     * Scan keys
     */
    scan(
        cursor: string,
        pattern: string,
        count: number
    ): Promise<[string, string[]]>;

    /**
     * Pipeline operations
     */
    pipeline(): any;

    /**
     * Multi operations
     */
    multi(): any;
};