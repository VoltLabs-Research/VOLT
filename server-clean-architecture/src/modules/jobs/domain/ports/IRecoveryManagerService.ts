import { JobDeserializer, RecoveryManagerConfig } from '@modules/jobs/infrastructure/services/RecoveryManagerService';
import Job from '@modules/jobs/domain/entities/Job';

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