import { JobHandlerConfig } from "../../infrastructure/services/JobHandlerService";
import Job, { JobStatus } from "../entities/Job";

export interface JobInfo<T extends Job> {
    job: T;
    rawData: string;
};

export interface IJobHandlerService {
    initialize(config: JobHandlerConfig): void;

    /**
     * Set job status
     */
    setJobStatus(
        jobId: string,
        status: JobStatus,
        data: any
    ): Promise<void>;

    /**
     * Get job status
     */
    getJobStatus(jobId: string): Promise<any | null>;

    /**
     * Handle job failure with retry logic
     * Returns true if session should be cleaned up
     */
    handleJobFailure(
        job: Job,
        error: string,
        rawData: string,
        queueKey: string
    ): Promise<boolean>;

    /**
     * Track job completion
     */
    trackJobCompletion(
        job: Job,
        status: JobStatus
    ): Promise<void>;

    /**
     * Track job increment at start
     */
    trackJobIncrement(
        job: Job,
        sessionId: string
    ): Promise<void>;

    /**
     * Cancel a job
     */
    cancelJob(trajectoryId: string, jobId: string): Promise<void>;

    /**
     * Retry failed jobs for a trajectory
     */
    retryFailedJobs(trajectoryId: string): Promise<number>;
};