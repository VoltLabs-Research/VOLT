import Job from '@modules/jobs/domain/entities/Job';

export interface RecoveryManagerConfig {
    queueKey: string;
    processingKey: string;
    statusKeyPrefix: string;
    startupLockTTLMs: number;
    ttlSeconds: number;
};

export interface JobDeserializer<T extends Job> {
    (rawData: string): T;
};

export interface IRecoveryManagerService{
    initialize(
        config: RecoveryManagerConfig,
        deserializeJob: JobDeserializer<Job>
    ): void;

    /**
     * Executes a function with a distributed startup lock.
     */
    withStartupLock<R>(fn: () => Promise<R>): Promise<R | undefined>;

    /**
     * Drain jobs from processing list back to queue.
     */
    drainProcessingIntoQueue(): Promise<number>;

    /**
     * Requeue jobs that were running during a crash/restart.
     */
    requeueStaleRunningJobs(): Promise<void>;

    /**
     * Perform full startup recovery.
     */
    recoverOnStartup(): Promise<void>;
};