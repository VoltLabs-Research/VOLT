import { inject } from 'tsyringe';
import { WorkerPoolItem } from '../../domain/entities/WorkerStatus';
import { IJobQueueService, QueueOptions } from '../../domain/ports/IJobQueueService';
import { IJobRepository } from '../../domain/ports/IJobRepository';
import { IWorkerPoolService, WorkerPoolConfig } from '../../domain/ports/IWorkerPool';
import { ISessionManagerService } from '../../domain/ports/ISessionManagerService';
import { IRecoveryManagerService } from '../../domain/ports/IRecoveryManagerService';
import { IJobHandlerService, JobInfo } from '../../domain/ports/IJobHandlerService';
import { IEventBus } from '../../../../shared/application/events/IEventBus';
import { IQueueRegistry } from '../../domain/ports/IQueueRegistry';
import { JOBS_TOKENS } from '../di/JobsTokens';
import Job, { JobStatus } from '../../domain/entities/Job';
import JobsAddedEvent from '../../application/events/JobsAddedEvent';
import JobProgressEvent from '../../application/events/JobProgressEvent';
import os from 'node:os';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';

interface QueueConstants {
    MIN_WORKERS: number;
    IDLE_WORKER_TTL_MS: number;
    CRASH_WINDOW_MS: number;
    MAX_CONSECUTIVE_CRASHES: number;
    CRASH_BACKOFF_MS: number;
    WORKER_MAX_OLD_GENERATION_SIZE_MB: number;
    SESSION_TTL_SECONDS: number;
    STARTUP_LOCK_TTL_MS: number;
    TTL_SECONDS: number;
    BATCH_SIZE: number;
};

export default abstract class BaseProcessingQueue<T extends Job = Job> implements IJobQueueService {
    protected readonly queueName: string;
    protected readonly workerPath: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly options: QueueOptions;

    readonly queueKey: string;
    readonly processingKey: string;
    readonly statusKeyPrefix: string;

    protected jobMap = new Map<number, JobInfo<T>>();
    private isShutdown = false;
    private mapping: Record<string, string>;
    private constants: QueueConstants;

    constructor(
        options: QueueOptions,
        @inject(JOBS_TOKENS.JobRepository)
        protected readonly jobRepository: IJobRepository,

        @inject(JOBS_TOKENS.WorkerPoolService)
        private readonly workerPoolService: IWorkerPoolService,

        @inject(JOBS_TOKENS.SessionManagerService)
        private readonly sessionManager: ISessionManagerService,

        @inject(JOBS_TOKENS.RecoveryManagerService)
        private readonly recoveryManager: IRecoveryManagerService,

        @inject(JOBS_TOKENS.JobHandlerService)
        private readonly jobHandler: IJobHandlerService,

        @inject(JOBS_TOKENS.QueueConstants)
        constants: QueueConstants,

        @inject(SHARED_TOKENS.EventBus)
        protected readonly eventBus: IEventBus,

        @inject(JOBS_TOKENS.QueueRegistry)
        private readonly queueRegistry: IQueueRegistry
    ) {
        this.queueName = options.queueName;
        this.workerPath = options.workerPath;
        this.options = options;
        this.constants = constants;

        this.mapping = options.customStatusMapping || {
            completed: 'completed',
            queued: 'queued',
            running: 'running',
            failed: 'failed'
        };

        this.queueKey = `${this.queueName}_queue`;
        this.processingKey = `${this.queueKey}:processing`;
        this.statusKeyPrefix = `${this.queueKey}:status:`;

        this.maxConcurrentJobs = options.maxConcurrentJobs || Math.max(2, Math.floor(os.cpus().length * 0.75));

        const clusterId = process.env.CLUSTER_ID ?? os.hostname();

        // Register this queue in the queue registry
        this.queueRegistry.registerQueue({
            queueName: this.queueName,
            queueKey: this.queueKey,
            processingKey: this.processingKey,
            statusKeyPrefix: this.statusKeyPrefix
        });

        this.initializeServices();
    }

    private initializeServices(): void {
        const workerPoolConfig: WorkerPoolConfig = {
            workerPath: this.workerPath,
            maxConcurrentJobs: this.maxConcurrentJobs,
            minWorkers: this.constants.MIN_WORKERS,
            idleWorkerTTL: this.constants.IDLE_WORKER_TTL_MS,
            crashWindowMs: this.constants.CRASH_WINDOW_MS,
            maxConsecutiveCrashes: this.constants.MAX_CONSECUTIVE_CRASHES,
            crashBackoffMs: this.constants.CRASH_BACKOFF_MS,
            maxOldGenerationSizeMb: this.constants.WORKER_MAX_OLD_GENERATION_SIZE_MB
        };

        this.workerPoolService.initialize(
            workerPoolConfig,
            (workerId, message) => this.handleWorkerMessage(workerId, message),
            (workerId, error) => this.handleWorkerError(workerId, error),
            (workerId, code) => this.handleWorkerExit(workerId, code),
            () => this.jobRepository.getQueueLength(this.queueKey)
        );

        this.sessionManager.initialize({
            queueName: this.queueName,
            sessionTTLSeconds: this.constants.SESSION_TTL_SECONDS
        });

        this.recoveryManager.initialize({
            queueKey: this.queueKey,
            processingKey: this.processingKey,
            statusKeyPrefix: this.statusKeyPrefix,
            startupLockTTLMs: this.constants.STARTUP_LOCK_TTL_MS,
            ttlSeconds: this.constants.TTL_SECONDS
        }, (rawData) => this.deserializeJob(rawData));

        this.jobHandler.initialize({
            queueName: this.queueName,
            statusKeyPrefix: this.statusKeyPrefix,
            ttlSeconds: this.constants.TTL_SECONDS
        });
    }

    protected deserializeJob(rawData: string): T {
        const data = JSON.parse(rawData);
        return new Job(data.props || data) as unknown as T;
    }

    protected async onBeforeDecrement(job: T): Promise<number> {
        return 0;
    }

    getAvailableWorkerCount(): number {
        return this.workerPoolService.getAvailableWorkerCount();
    }

    async getJobStatus(jobId: string): Promise<any | null> {
        return this.jobHandler.getJobStatus(jobId);
    }

    getMappedStatus(jobStatus: string): string {
        return this.mapping[jobStatus] || jobStatus;
    }

    public async addJobs(jobs: T[]): Promise<void> {
        if (jobs.length === 0) return;

        const sessionId = this.sessionManager.generateSessionID();
        const sessionStartTime = new Date();

        const jobsWithSession = jobs.map((job: any) => {
            // Handle both Job instances and plain objects (from old server pattern)
            const jobData = job.props ? job.props : job;

            // Merge metadata with all job fields to preserve everything
            const metadata = {
                ...(jobData.metadata || {}),
                ...jobData  // Include all fields for socket emission
            };

            const newJobProps = {
                jobId: jobData.jobId,
                teamId: jobData.teamId,
                queueType: jobData.queueType || this.queueName,
                status: jobData.status || JobStatus.Queued,
                sessionId,
                message: jobData.message,
                progress: jobData.progress || 0,
                metadata,
                createdAt: jobData.createdAt || new Date(),
                updatedAt: jobData.updatedAt || new Date()
            };
            return Job.create(newJobProps);
        });

        await this.sessionManager.initializeSession(
            sessionId,
            sessionStartTime,
            jobs.length,
            jobsWithSession[0]
        );

        for (const job of jobsWithSession) {
            await this.jobHandler.trackJobIncrement(job, sessionId);
        }

        await this.addJobsBatch(jobsWithSession, sessionId);

        const event = new JobsAddedEvent({
            sessionId,
            queueType: this.queueName,
            teamId: jobsWithSession[0].props.teamId,
            count: jobs.length,
            metadata: jobsWithSession[0].props.metadata
        });

        await this.eventBus.publish(event);
    }

    public async handleWorkerMessage(workerId: number, message: any): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if (!jobInfo) return;

        const { job, rawData } = jobInfo;
        const statusKey = `${this.statusKeyPrefix}${job.props.jobId}`;
        const retryCountKey = `job:retries:${job.props.jobId}`;
        const updateData = {
            ...job.props,
            progress: message.progress,
            message: message.message
        };

        switch (message.status) {
            case 'progress':
                await this.jobHandler.setJobStatus(job.props.jobId, JobStatus.Running, updateData);

                const event = new JobProgressEvent({
                    jobId: job.props.jobId,
                    teamId: job.props.teamId,
                    queueType: this.queueName,
                    progress: message.progress,
                    message: message.message,
                    metadata: job.props.metadata
                });

                await this.eventBus.publish(event);
                return;

            case 'completed':
                await this.jobHandler.setJobStatus(job.props.jobId, JobStatus.Completed, updateData);
                await this.jobRepository.setWithExpiry(
                    statusKey,
                    JSON.stringify(updateData),
                    this.constants.TTL_SECONDS
                );
                await this.jobRepository.deleteRetryCounter(retryCountKey);
                await this.sessionManager.checkAndCleanupSession(job);

                await this.jobHandler.trackJobCompletion(job, JobStatus.Completed);
                await this.finishJob(workerId, rawData);
                break;

            case 'failed':
                const shouldCleanupSession = await this.jobHandler.handleJobFailure(
                    job,
                    message.error,
                    rawData,
                    this.queueKey
                );

                if (shouldCleanupSession) {
                    await this.jobRepository.setWithExpiry(
                        statusKey,
                        JSON.stringify(updateData),
                        this.constants.TTL_SECONDS
                    );

                    await this.sessionManager.checkAndCleanupSession(job);
                }

                await this.jobHandler.trackJobCompletion(job, JobStatus.Failed);
                await this.finishJob(workerId, rawData);
                break;
        }
    }

    private async handleWorkerError(workerId: number, error: Error): Promise<void> {
        await this.markJobFailed(workerId, error.message);
    }

    private async handleWorkerExit(workerId: number, code: number): Promise<void> {
        await this.markJobFailed(workerId, `Worker exited with code ${code}`);
    }

    private async markJobFailed(workerId: number, errorMessage: string): Promise<boolean> {
        const jobInfo = this.jobMap.get(workerId);
        if (!jobInfo) {
            return false;
        }

        const { job, rawData } = jobInfo;
        await this.jobHandler.setJobStatus(job.props.jobId, JobStatus.Failed, {
            error: errorMessage,
            ...job.props
        });

        await this.jobRepository.removeFromProcessing(this.processingKey, rawData);
        await this.finishJob(workerId, rawData);
        return true;
    }

    protected async finishJob(workerId: number, rawData: string): Promise<void> {
        const workerItem = this.workerPoolService.findWorkerByThreadId(workerId);
        if (workerItem) {
            workerItem.isIdle = true;
            workerItem.lastUsed = Date.now();
            this.workerPoolService.clearWorkerTimers(workerItem);
            this.workerPoolService.scheduleScaleDown(workerItem);
        }

        this.jobMap.delete(workerId);
        await this.jobRepository.removeFromProcessing(this.processingKey, rawData);
    }

    private async assignJobToWorker(workerItem: WorkerPoolItem, job: T, rawData: string): Promise<void> {
        workerItem.isIdle = false;
        this.workerPoolService.clearWorkerTimers(workerItem);
        workerItem.currentJobId = job.props.jobId;
        workerItem.lastUsed = Date.now();
        this.jobMap.set(workerItem.worker.threadId, { job, rawData });

        try {
            await this.jobHandler.setJobStatus(job.props.jobId, JobStatus.Running, {
                ...job.props,
                workerId: workerItem.worker.threadId
            });
            workerItem.worker.postMessage({ job });
        } catch (error) {
            workerItem.isIdle = true;
            this.jobMap.delete(workerItem.worker.threadId);
            console.log(error);
            throw error;
        }
    }

    private async dispatchJob(rawData: string): Promise<void> {
        const workers = this.workerPoolService.getWorkers();
        let idleWorker = workers.find((item) => item.isIdle);

        if (!idleWorker && this.workerPoolService.getPoolSize() < this.maxConcurrentJobs) {
            await this.workerPoolService.scaleUp(1);
            idleWorker = this.workerPoolService.getWorkers().find((item) => item.isIdle) ?? null as any;
        }

        if (!idleWorker) {
            console.warn(`[${this.queueName}] No idle worker found for job dispatch.`);
            return;
        }

        const job = this.deserializeJob(rawData);
        console.log(`[${this.queueName}] Assigning job ${job.props.jobId} to worker ${idleWorker.worker.threadId}`);
        await this.assignJobToWorker(idleWorker, job, rawData);
    }

    async handleFailedJobDispatch(rawData: string): Promise<void> {
        await this.jobRepository.moveToQueue(
            this.queueKey,
            this.processingKey,
            rawData
        );
    }

    private async dispatchJobs(jobs: string[]): Promise<void> {
        for (const rawData of jobs) {
            try {
                await this.dispatchJob(rawData);
            } catch (error) {
                await this.handleFailedJobDispatch(rawData);
            }
        }
    }

    private async fetchJobs(count: number): Promise<string[]> {
        if (count <= 0) return [];

        const jobs: string[] = [];
        const first = await this.jobRepository.getFromQueue(this.queueKey, this.processingKey, 1);
        if (first) jobs.push(first);

        if (jobs.length < count) {
            const remaining = await this.jobRepository.getMultipleFromQueue(
                this.queueKey,
                this.processingKey,
                count - jobs.length
            );
            jobs.push(...remaining);
        }

        return jobs;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async startDispatchLoop(): Promise<void> {
        let noWorkersLogCount = 0;
        console.log(`[${this.queueName}] Starting dispatch loop...`);
        while (!this.isShutdown) {
            try {
                const backlog = await this.jobRepository.getQueueLength(this.queueKey);
                // console.log(`[${this.queueName}] Backlog: ${backlog}`);

                const workers = this.workerPoolService.getPoolSize();
                const desired = Math.min(this.maxConcurrentJobs, backlog);
                const toSpawn = Math.max(0, desired - workers);

                if (toSpawn > 0) {
                    console.log(`[${this.queueName}] Spawning ${toSpawn} workers...`);
                    await this.workerPoolService.scaleUp(toSpawn);
                }

                const available = this.getAvailableWorkerCount();
                if (backlog > 0 && available === 0) {
                    if (noWorkersLogCount++ % 50 === 0) {
                        console.log(`[${this.queueName}] Backlog: ${backlog}, Workers: ${workers}, Available: ${available} - Waiting for workers...`);
                    }
                    await this.sleep(100);
                    continue;
                }

                noWorkersLogCount = 0;

                const jobsToProcess = Math.min(available, this.constants.BATCH_SIZE);
                if (jobsToProcess > 0 && backlog > 0) {
                    // Only fetch if available capacity and jobs exist
                    const jobs = await this.fetchJobs(jobsToProcess);
                    if (jobs.length === 0) {
                        // console.log(`[${this.queueName}] Fetch returned empty`);
                        await this.sleep(100);
                        continue;
                    }
                    console.log(`[${this.queueName}] Dispatching ${jobs.length} jobs...`);
                    await this.dispatchJobs(jobs);
                } else {
                    await this.sleep(100);
                }
            } catch (error) {
                console.error(`[${this.queueName}] Error in dispatch loop:`, error);
                await this.sleep(1000);
            }
        }
    }

    async start(): Promise<void> {
        await this.workerPoolService.scaleUp(this.constants.MIN_WORKERS);
        await this.recoveryManager.recoverOnStartup();
        // Start dispatch loop in background (don't await - it's an infinite loop)
        this.startDispatchLoop();
    }

    async stop(): Promise<void> {
        this.isShutdown = true;
        this.workerPoolService.terminateAll();
    }

    private async addJobsBatch(
        jobs: Job[],
        sessionId: string
    ): Promise<void> {
        const regularJobs: string[] = [];
        for (const job of jobs) {
            const serialized = JSON.stringify(job.props);
            regularJobs.push(serialized);
        }

        if (regularJobs.length > 0) {
            await this.jobRepository.addToQueue(this.queueKey, regularJobs);
        }

        const statusPromises = jobs.map((job) => this.jobHandler.setJobStatus(job.props.jobId, JobStatus.Queued, {
            ...job.props,
            sessionId
        }));

        await Promise.all(statusPromises);
    }
};