import { inject } from 'tsyringe';
import { ConnectionOptions, Job as BullJob, JobProgress } from 'bullmq';
import IORedis from 'ioredis';
import os from 'node:os';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobSession from '@modules/jobs/domain/entities/JobSession';
import { IJobQueueService, QueueOptions } from '@modules/jobs/domain/port/IJobQueueService';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import ProcessingQueueEventPublisher from '@modules/jobs/infrastructure/services/ProcessingQueueEventPublisher';
import ProcessingQueueJobFactory from '@modules/jobs/infrastructure/services/ProcessingQueueJobFactory';
import ProcessingQueueRuntime, { QueueBulkJob } from '@modules/jobs/infrastructure/services/ProcessingQueueRuntime';
import ProcessingQueueSessionCompletionService from '@modules/jobs/infrastructure/services/ProcessingQueueSessionCompletionService';
import ProcessingQueueSessionStore from '@modules/jobs/infrastructure/services/ProcessingQueueSessionStore';
import ProcessingQueueStatusProjectionService from '@modules/jobs/infrastructure/services/ProcessingQueueStatusProjectionService';
import { QueueJobData, hasJobProps, JOB_STATUS_KEY_PREFIX } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import { ErrorCodes } from '@core/constants/error-codes';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import {
    WorkerFailureError,
    getWorkerFailureErrorMessage,
    normalizeWorkerFailureEnvelope
} from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

export default abstract class BaseProcessingQueue<T extends Job = Job> implements IJobQueueService {
    protected readonly queueName: string;
    protected readonly workerPath: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly options: QueueOptions;

    private readonly mapping: Record<string, string>;
    private readonly connection: ConnectionOptions;
    private readonly runtime: ProcessingQueueRuntime;
    private readonly jobFactory: ProcessingQueueJobFactory;
    private readonly eventPublisher: ProcessingQueueEventPublisher;
    private readonly sessionStore: ProcessingQueueSessionStore;
    private readonly sessionCompletionService: ProcessingQueueSessionCompletionService;
    private readonly statusProjectionService: ProcessingQueueStatusProjectionService;

    constructor(
        options: QueueOptions,
        @inject(SHARED_TOKENS.RedisClient)
        protected readonly redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        protected readonly eventBus: IEventBus,

        @inject(JOBS_TOKENS.QueueRegistry)
        private readonly queueRegistry: IQueueRegistry
    ) {
        this.queueName = options.queueName;
        this.workerPath = options.workerPath;
        this.options = options;
        this.maxConcurrentJobs = options.maxConcurrentJobs || Math.max(2, Math.floor(os.cpus().length * 0.75));
        this.mapping = options.customStatusMapping || {
            completed: 'completed',
            queued: 'queued',
            running: 'running',
            failed: 'failed'
        };

        this.connection = this.createConnectionOptions();
        this.jobFactory = new ProcessingQueueJobFactory(this.queueName);
        this.eventPublisher = new ProcessingQueueEventPublisher(this.eventBus, this.queueName);
        this.sessionStore = new ProcessingQueueSessionStore(this.redis);
        this.sessionCompletionService = new ProcessingQueueSessionCompletionService(
            this.queueName,
            this.sessionStore,
            this.eventPublisher
        );
        this.statusProjectionService = new ProcessingQueueStatusProjectionService(this.redis, this.queueName);

        this.queueRegistry.registerQueue({
            queueName: this.queueName,
            queueKey: `bull:${this.queueName}:wait`,
            processingKey: `bull:${this.queueName}:active`,
            statusKeyPrefix: JOB_STATUS_KEY_PREFIX
        });

        this.runtime = new ProcessingQueueRuntime(
            {
                queueName: this.queueName,
                workerPath: this.workerPath,
                maxConcurrentJobs: this.maxConcurrentJobs,
                connection: this.connection
            },
            {
                onActive: (bullJob) => this.onJobActive(bullJob),
                onProgress: (bullJob, progress) => this.onJobProgress(bullJob, progress),
                onCompleted: (bullJob) => this.onJobCompleted(bullJob),
                onFailed: (bullJob, error) => this.onJobFailed(bullJob, error)
            }
        );
    }

    getAvailableWorkerCount(): number {
        return this.maxConcurrentJobs;
    }

    async getJobStatus(jobId: string): Promise<Record<string, unknown> | null> {
        return this.statusProjectionService.getJobStatus(jobId);
    }

    getMappedStatus(jobStatus: string): string {
        return this.mapping[jobStatus] || jobStatus;
    }

    getQueueName(): string {
        return this.queueName;
    }

    public async addJobs(jobs: T[]): Promise<void> {
        if (jobs.length === 0) {
            return;
        }

        const sessionId = JobSession.generateSessionId();
        const sessionStartTime = new Date();
        const jobsWithSession = this.jobFactory.buildSessionJobs(jobs, sessionId, sessionStartTime, false);
        const sessionData = this.jobFactory.createSessionData(sessionId, jobsWithSession, sessionStartTime);

        await this.sessionStore.persistSession(sessionData);
        await this.enqueueJobs(jobsWithSession, sessionId);
    }

    public async retryFailedJobs(jobs: T[]): Promise<number> {
        if (jobs.length === 0) {
            return 0;
        }

        const retryableJobs: T[] = [];

        for (const job of jobs) {
            if (!hasJobProps(job)) {
                logger.warn(`[${this.queueName}] Skipping invalid retry job without props`);
                continue;
            }

            const bullJob = await this.runtime.getJob(job.props.jobId);

            if (!bullJob) {
                retryableJobs.push(job);
                continue;
            }

            const state = await bullJob.getState();
            if (state !== 'failed') {
                logger.warn(`[${this.queueName}] Skipping retry for job ${job.props.jobId} with state ${state}`);
                continue;
            }

            await bullJob.remove();
            retryableJobs.push(job);
        }

        if (retryableJobs.length === 0) {
            return 0;
        }

        const sessionId = JobSession.generateSessionId();
        const sessionStartTime = new Date();
        const jobsWithSession = this.jobFactory.buildSessionJobs(retryableJobs, sessionId, sessionStartTime, true);
        const sessionData = this.jobFactory.createSessionData(sessionId, jobsWithSession, sessionStartTime);

        await this.sessionStore.persistSession(sessionData);
        await this.enqueueJobs(jobsWithSession, sessionId);

        return jobsWithSession.length;
    }

    public async abortRunningJobs(jobIds: string[]): Promise<number> {
        if (jobIds.length === 0) {
            return 0;
        }

        let aborted = 0;
        for (const jobId of jobIds) {
            const bullJob = await this.runtime.getJob(jobId);
            if (!bullJob) {
                continue;
            }

            const state = await bullJob.getState();
            if (state === 'active') {
                const failure = normalizeWorkerFailureEnvelope({
                    error: new WorkerFailureError({
                        code: ErrorCodes.JOB_CANCELLED,
                        message: ErrorCodes.JOB_CANCELLED,
                        details: 'Cancelled by user'
                    }),
                    fallbackCode: ErrorCodes.JOB_CANCELLED
                });
                await bullJob.moveToFailed(new WorkerFailureError(failure), '0', true);
                aborted += 1;
            } else if (state === 'waiting' || state === 'delayed') {
                await bullJob.remove();
                aborted += 1;
            }
        }

        return aborted;
    }

    async start(): Promise<void> {
        logger.info(`[${this.queueName}] BullMQ queue and worker started with concurrency=${this.maxConcurrentJobs}`);
    }

    async stop(): Promise<void> {
        await this.runtime.close();
        logger.info(`[${this.queueName}] BullMQ queue and worker stopped`);
    }

    private createConnectionOptions(): ConnectionOptions {
        return {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: Number(process.env.REDIS_DB) || 0,
            maxRetriesPerRequest: null
        };
    }

    private async enqueueJobs(jobs: Job[], sessionId: string): Promise<void> {
        const firstJob = jobs[0];
        if (!hasJobProps(firstJob)) {
            throw new Error(`[${this.queueName}] Invalid first job payload while enqueueing jobs`);
        }

        const bullJobs: QueueBulkJob[] = jobs.map((job) => ({
            name: this.queueName,
            data: job.props as unknown as QueueJobData,
            opts: {
                jobId: job.props.jobId
            }
        }));

        await this.eventPublisher.publishQueuedJobs(jobs, sessionId);
        await this.runtime.addBulk(bullJobs);

        await Promise.all(jobs.map((job) =>
            this.updateJobStatus(job.props.jobId, JobStatus.Queued, job.props as unknown as QueueJobData)
        ));

        await this.eventPublisher.publishJobsAdded(firstJob, sessionId, jobs.length);
    }

    private async updateJobStatus(jobId: string, status: JobStatus, data: QueueJobData): Promise<void> {
        const projection = await this.statusProjectionService.project(jobId, status, data);

        if (!projection.teamId) {
            return;
        }

        await this.eventPublisher.publishStatusChanged(jobId, projection.teamId, status, projection.statusData);
    }

    private async onJobActive(bullJob: BullJob): Promise<void> {
        const jobData = this.asQueueJobData(bullJob.data);
        await this.updateJobStatus(String(jobData.jobId), JobStatus.Running, jobData);
    }

    private async onJobProgress(bullJob: BullJob, progress: JobProgress): Promise<void> {
        const jobData = this.asQueueJobData(bullJob.data);
        const progressValue = typeof progress === 'number'
            ? progress
            : Number((isRecord(progress) ? progress.progress : 0) || 0);
        const progressMessage = isRecord(progress) && typeof progress.message === 'string'
            ? progress.message
            : undefined;

        await this.updateJobStatus(String(jobData.jobId), JobStatus.Running, {
            ...jobData,
            progress: progressValue,
            message: progressMessage || jobData.message
        });

        await this.eventPublisher.publishProgress(jobData, progressValue, progressMessage);
    }

    private async onJobCompleted(bullJob: BullJob): Promise<void> {
        const jobData = this.asQueueJobData(bullJob.data);

        try {
            await this.updateJobStatus(String(jobData.jobId), JobStatus.Completed, jobData);
            await this.eventPublisher.publishCompleted(jobData);
        } catch (error) {
            logger.error(
                error,
                `[${this.queueName}] Failed to publish completion for job ${jobData.jobId}, proceeding with session cleanup`
            );
        }

        await this.sessionCompletionService.handleJobSettlement(jobData);
    }

    private async onJobFailed(bullJob: BullJob | undefined, error: Error): Promise<void> {
        if (!bullJob) {
            return;
        }

        const jobData = this.asQueueJobData(bullJob.data);
        const failure = normalizeWorkerFailureEnvelope({
            error,
            fallbackCode: ErrorCodes.WORKER_FAILURE
        });

        try {
            await this.updateJobStatus(String(jobData.jobId), JobStatus.Failed, {
                ...jobData,
                error: getWorkerFailureErrorMessage(failure),
                failure
            });
            await this.eventPublisher.publishFailed(jobData, failure);
        } catch (publishError) {
            logger.error(
                publishError,
                `[${this.queueName}] Failed to publish failure for job ${jobData.jobId}, proceeding with session cleanup`
            );
        }

        const sessionId = typeof jobData.sessionId === 'string' ? jobData.sessionId : undefined;
        if (sessionId) {
            try {
                await this.sessionStore.recordFailure(sessionId, failure);
            } catch (recordError) {
                logger.error(
                    recordError,
                    `[${this.queueName}] Failed to record session failure for session ${sessionId}`
                );
            }
        }

        await this.sessionCompletionService.handleJobSettlement(jobData);
    }

    private asQueueJobData(value: unknown): QueueJobData {
        return isRecord(value) ? value : {};
    }
}
