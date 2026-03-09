import Job from '@modules/jobs/domain/entities/Job';
import type { Job as BullJob } from 'bullmq';

export type InlineProcessor = (job: BullJob) => Promise<void>;

export interface QueueOptions {
    queueName: string;
    workerPath: string;
    maxConcurrentJobs?: number;
    customStatusMapping?: Record<string, string>;
    withWorker?: boolean;
    workerExecArgv?: string[];
    inlineProcessor?: InlineProcessor;
};

export interface IJobQueueService {
    addJobs(jobs: Job[]): Promise<void>;
    retryFailedJobs(jobs: Job[]): Promise<number>;
    getJobStatus(jobId: string): Promise<Record<string, unknown> | null>;
    getAvailableWorkerCount(): number;
    getMappedStatus(jobStatus: string): string;
    getQueueName(): string;
    start(): Promise<void>;
    stop(): Promise<void>;
    abortRunningJobs(jobIds: string[]): Promise<number>;
};
