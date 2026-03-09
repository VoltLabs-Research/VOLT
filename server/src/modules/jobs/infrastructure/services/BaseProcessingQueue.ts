import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { createQueueConnectionFromRedisClient } from '@modules/jobs/infrastructure/services/redis-queue-connection';
import { JOB_STATUS_KEY_PREFIX, hasJobProps } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import { ErrorCodes } from '@core/constants/error-codes';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import {
    WorkerFailureError,
    getWorkerFailureErrorMessage,
    normalizeWorkerFailureEnvelope
} from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import Job from '@modules/jobs/domain/entities/Job';
import JobSession from '@modules/jobs/domain/entities/JobSession';
import ProcessingQueueEventPublisher from '@modules/jobs/infrastructure/services/ProcessingQueueEventPublisher';
import ProcessingQueueJobFactory from '@modules/jobs/infrastructure/services/ProcessingQueueJobFactory';
import ProcessingQueueRuntime from '@modules/jobs/infrastructure/services/ProcessingQueueRuntime';
import ProcessingQueueSessionCompletionService from '@modules/jobs/infrastructure/services/ProcessingQueueSessionCompletionService';
import ProcessingQueueSessionStore from '@modules/jobs/infrastructure/services/ProcessingQueueSessionStore';
import ProcessingQueueStatusProjectionService from '@modules/jobs/infrastructure/services/ProcessingQueueStatusProjectionService';
import IORedis from 'ioredis';
import os from 'node:os';
import logger from '@shared/infrastructure/logger';
import type { IJobQueueService, QueueOptions } from '@modules/jobs/domain/port/IJobQueueService';
import type { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import type { QueueBulkJob } from '@modules/jobs/infrastructure/services/ProcessingQueueRuntime';
import type { QueueJobData } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { Job as BullJob, JobProgress } from 'bullmq';

interface BaseProcessingQueueDependencies {
    redis: IORedis;
    eventBus: IEventBus;
    queueRegistry: IQueueRegistry;
};

export default abstract class BaseProcessingQueue<T extends Job = Job> implements IJobQueueService {
    protected readonly queueName: string;
    protected readonly workerPath: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly options: QueueOptions;

    private readonly mapping: Record<string, string>;
    private readonly runtime: ProcessingQueueRuntime;
    private readonly jobFactory: ProcessingQueueJobFactory;
    private readonly eventPublisher: ProcessingQueueEventPublisher;
    private readonly sessionStore: ProcessingQueueSessionStore;
    private readonly sessionCompletionService: ProcessingQueueSessionCompletionService;
    private readonly statusProjectionService: ProcessingQueueStatusProjectionService;

    constructor(
        options: QueueOptions,
        protected readonly dependencies: BaseProcessingQueueDependencies
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

        this.jobFactory = new ProcessingQueueJobFactory(this.queueName);
        this.eventPublisher = new ProcessingQueueEventPublisher(this.dependencies.eventBus, this.queueName);
        this.sessionStore = new ProcessingQueueSessionStore(this.dependencies.redis);
        this.sessionCompletionService = new ProcessingQueueSessionCompletionService(
            this.queueName,
            this.sessionStore,
            this.eventPublisher
        );
        this.statusProjectionService = new ProcessingQueueStatusProjectionService(this.dependencies.redis, this.queueName);

        this.dependencies.queueRegistry.registerQueue({
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
                connection: this.createConnectionOptions(),
                withWorker: this.options.withWorker,
                workerExecArgv: this.options.workerExecArgv,
                inlineProcessor: this.options.inlineProcessor
            },
            {
                onActive: this.onJobActive.bind(this),
                onProgress: this.onJobProgress.bind(this),
                onCompleted: this.onJobCompleted.bind(this),
                onFailed: this.onJobFailed.bind(this)
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
        await this.addJobsWithSession(jobs);
    }

    protected async addJobsWithSession(jobs: T[]): Promise<{ sessionId: string }> {
        if (jobs.length === 0) {
            return { sessionId: JobSession.generateSessionId() };
        }

        const sessionId = JobSession.generateSessionId();
        const sessionStartTime = new Date();
        const jobsWithSession = this.jobFactory.buildSessionJobs(jobs, sessionId, sessionStartTime, false);
        const sessionData = this.jobFactory.createSessionData(sessionId, jobsWithSession, sessionStartTime);

        await this.sessionStore.persistSession(sessionData);
        await this.enqueueJobs(jobsWithSession, sessionId);

        return { sessionId };
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

    private createConnectionOptions() {
        return createQueueConnectionFromRedisClient(this.dependencies.redis);
    }

    private async enqueueJobs(jobs: Job[], sessionId: string): Promise<void> {
        const firstJob = jobs[0];
        if (!hasJobProps(firstJob)) {
            throw new Error(`[${this.queueName}] Invalid first job payload while enqueueing jobs`);
        }

        const bullJobs: QueueBulkJob[] = jobs.map((job) => ({
            name: this.queueName,
            data: job.props,
            opts: {
                jobId: job.props.jobId
            }
        }));

        logger.info(`[${this.queueName}] Enqueueing ${bullJobs.length} jobs (session=${sessionId}, firstJobId=${firstJob.props.jobId})`);

        await this.eventPublisher.publishQueuedJobs(jobs, sessionId);
        await this.runtime.addBulk(bullJobs);

        logger.info(`[${this.queueName}] Jobs added to BullMQ queue successfully`);

        await Promise.all(jobs.map((job) =>
            this.updateJobStatus(job.props.jobId, JobStatus.Queued, job.props)
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
        let progressValue = 0;
        if (typeof progress === 'number') {
            progressValue = progress;
        } else {
            let progressSource: number | string = 0;
            if (isRecord(progress)) {
                if (typeof progress.progress === 'number' || typeof progress.progress === 'string') {
                    progressSource = progress.progress;
                }
            }

            progressValue = Number(progressSource || 0);
        }

        let progressMessage: string | undefined;
        if (isRecord(progress) && typeof progress.message === 'string') {
            progressMessage = progress.message;
        }

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
        let jobData: QueueJobData = {};
        if (isRecord(value)) {
            jobData = value;
        }

        return jobData;
    }
};
