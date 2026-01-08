/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import IORedis from 'ioredis';
import * as os from 'node:os';
import { EventEmitter } from 'events';
import { BaseJob, QueueOptions, WorkerPoolItem } from '@/types/queues/base-processing-queue';
import { createRedisClient } from '@config/redis';
import { QUEUE_DEFAULTS } from '@/config/queue-defaults';
import { WorkerPool, WorkerPoolConfig } from './worker-pool';
import { SessionManager } from './session-manager';
import { RecoveryManager } from './recovery-manager';
import { JobHandler, JobInfo } from './job-handler';
import logger from '@/logger';

/**
 * Base class for processing queues.
 * Orchestrates worker pool, session management, job handling, and recovery.
 */
export abstract class BaseProcessingQueue<T extends BaseJob> extends EventEmitter {
    protected readonly queueName: string;
    protected readonly workerPath: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly options: QueueOptions;

    readonly queueKey: string;
    readonly processingKey: string;
    readonly statusKeyPrefix: string;

    protected jobMap = new Map<number, JobInfo<T>>();
    private isShutdown = false;
    protected redis: IORedis;
    private redisBlocking: IORedis;
    private logPrefix: string;

    // Composed managers
    private workerPool: WorkerPool;
    private sessionManager: SessionManager<T>;
    private recoveryManager: RecoveryManager<T>;
    private jobHandler: JobHandler<T>;

    private mapping: Record<string, string>;

    constructor(options: QueueOptions) {
        super();

        this.queueName = `${options.queueName}`;
        this.workerPath = options.workerPath;
        this.options = options;

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

        const clusterId = process.env.CLUSTER_ID ? `[Cluster: ${process.env.CLUSTER_ID}] ` : '';
        this.logPrefix = `${clusterId}[${this.queueName}]`;

        this.redis = createRedisClient();
        this.redisBlocking = createRedisClient();

        // Initialize composed managers
        this.sessionManager = new SessionManager(this.redis, {
            queueName: this.queueName,
            logPrefix: this.logPrefix
        });

        this.recoveryManager = new RecoveryManager(this.redis, {
            queueKey: this.queueKey,
            processingKey: this.processingKey,
            statusKeyPrefix: this.statusKeyPrefix,
            logPrefix: this.logPrefix
        }, (rawData) => this.deserializeJob(rawData));

        this.jobHandler = new JobHandler(this.redis, {
            queueName: this.queueName,
            statusKeyPrefix: this.statusKeyPrefix,
            logPrefix: this.logPrefix
        });

        const workerPoolConfig: WorkerPoolConfig = {
            workerPath: this.workerPath,
            maxConcurrentJobs: this.maxConcurrentJobs,
            minWorkers: QUEUE_DEFAULTS.MIN_WORKERS,
            idleWorkerTTL: QUEUE_DEFAULTS.IDLE_WORKER_TTL_MS,
            crashWindowMs: QUEUE_DEFAULTS.CRASH_WINDOW_MS,
            maxConsecutiveCrashes: QUEUE_DEFAULTS.MAX_CONSECUTIVE_CRASHES,
            crashBackoffMs: QUEUE_DEFAULTS.CRASH_BACKOFF_MS,
            useWorkerThreads: options.useWorkerThreads,

            logPrefix: this.logPrefix,
            maxOldGenerationSizeMb: QUEUE_DEFAULTS.WORKER_MAX_OLD_GENERATION_SIZE_MB
        };

        this.workerPool = new WorkerPool(
            workerPoolConfig,
            (workerId, message) => this.handleWorkerMessage(workerId, message),
            (workerId, error) => this.handleWorkerError(workerId, error),
            (workerId, code) => this.handleWorkerExit(workerId, code),
            () => this.redis.llen(this.queueKey)
        );

        this.initializeQueue();
    }

    private logInfo(message: string): void {
        logger.info(`${this.logPrefix} ${message}`);
    }

    private logError(message: string): void {
        logger.error(`${this.logPrefix} ${message}`);
    }

    private logWarn(message: string): void {
        logger.warn(`${this.logPrefix} ${message}`);
    }

    protected abstract deserializeJob(rawData: string): T;

    protected async onBeforeDecrement(job: T): Promise<number> {
        return 0;
    }

    getAvailableWorkerCount(): number {
        return this.workerPool.getAvailableWorkerCount();
    }

    async getJobStatus(jobId: string): Promise<any | null> {
        return this.jobHandler.getJobStatus(jobId);
    }

    getMappedStatus(jobStatus: string): string {
        return this.mapping[jobStatus] || jobStatus;
    }

    async hasActiveJobsForTrajectory(trajectoryId: string): Promise<boolean> {
        const jobs = await this.redis.lrange(this.processingKey, 0, -1);
        for (const raw of jobs) {
            try {
                const job = JSON.parse(raw);
                if (job.trajectoryId === trajectoryId) {
                    return true;
                }
            } catch (e) { }
        }
        return false;
    }

    async hasQueuedJobsForTrajectory(trajectoryId: string): Promise<boolean> {
        const jobs = await this.redis.lrange(this.queueKey, 0, -1);
        for (const raw of jobs) {
            try {
                const job = JSON.parse(raw);
                if (job.trajectoryId === trajectoryId) {
                    return true;
                }
            } catch (e) { }
        }
        return false;
    }

    public async addJobs(jobs: T[]): Promise<void> {
        if (jobs.length === 0) return;

        const sessionId = this.sessionManager.generateSessionId();
        const sessionStartTime = new Date().toISOString();

        const jobsWithSession = jobs.map((job) => ({
            ...job,
            sessionId,
            sessionStartTime
        }));

        await this.sessionManager.initializeSession(sessionId, sessionStartTime, jobs.length, jobsWithSession[0]);

        // Track jobs at trajectory level
        this.logInfo(`Attempting to increment trajectory job counter for ${jobs.length} jobs...`);
        for (const job of jobsWithSession) {
            await this.jobHandler.trackJobIncrement(job, sessionId);
        }
        this.logInfo(`Successfully incremented counter for ${jobs.length} jobs`);

        await this.addJobsBatch(jobsWithSession, sessionId, sessionStartTime);
    }

    protected async handleWorkerMessage(workerId: number, message: any): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if (!jobInfo) return;

        const { job, rawData, startTime } = jobInfo;
        const processingTime = Date.now() - startTime;
        const statusKey = `${this.statusKeyPrefix}${job.jobId}`;
        const retryCountKey = `job:retries:${job.jobId}`;
        const updateData = {
            ...job,
            progress: message.progress,
            message: message.message,
            processingTimeMs: processingTime,
        };

        switch (message.status) {
            case 'progress':
                await this.jobHandler.setJobStatus(job.jobId, 'running', updateData);
                this.emit('jobProgress', { job, progress: message.progress });
                return;

            case 'completed':
                await this.jobHandler.setJobStatus(job.jobId, 'completed', updateData);
                this.redis.expire(statusKey, QUEUE_DEFAULTS.TTL_SECONDS);
                await this.redis.del(retryCountKey);
                await this.sessionManager.checkAndCleanupSession(job);

                // Allow subclasses to add dependent jobs before counter decrements
                try {
                    const dependentJobsAdded = await this.onBeforeDecrement(job);
                    if (dependentJobsAdded > 0) {
                        this.logInfo(`Added ${dependentJobsAdded} dependent jobs before decrement for job ${job.jobId}`);
                    }
                } catch (hookError) {
                    this.logError(`onBeforeDecrement hook failed: ${hookError}`);
                }

                await this.jobHandler.trackJobCompletion(job, 'completed');
                await this.finishJob(workerId, rawData);
                this.emit('jobCompleted', { job, result: message.result, processingTime });

                // Race condition fix: Update status AFTER job is removed from Redis active list
                if (job.trajectoryId && job.teamId) {
                    const trajectoryStatusService = (await import('@/services/trajectory/status-service')).default;
                    await trajectoryStatusService.updateFromJobStatus({
                        trajectoryId: job.trajectoryId,
                        teamId: job.teamId,
                        sessionId: job.sessionId,
                        jobStatus: 'completed',
                        queueType: this.queueName
                    });
                }
                break;

            case 'failed':
                const shouldCleanupSession = await this.jobHandler.handleJobFailure(
                    job, message.error, processingTime, rawData, this.queueKey
                );
                if (shouldCleanupSession) {
                    this.redis.expire(statusKey, QUEUE_DEFAULTS.TTL_SECONDS);
                    await this.sessionManager.checkAndCleanupSession(job);
                }

                await this.jobHandler.trackJobCompletion(job, 'failed');
                await this.finishJob(workerId, rawData);
                this.emit('jobFailed', { job, error: message.error, processingTime });

                // Race condition fix: Update status AFTER job is removed from Redis active list
                if (job.trajectoryId && job.teamId) {
                    const trajectoryStatusService = (await import('@/services/trajectory/status-service')).default;
                    await trajectoryStatusService.updateFromJobStatus({
                        trajectoryId: job.trajectoryId,
                        teamId: job.teamId,
                        sessionId: job.sessionId,
                        jobStatus: 'failed',
                        queueType: this.queueName
                    });
                }
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

        const { job, rawData, startTime } = jobInfo;
        const processingTime = Date.now() - startTime;

        await this.jobHandler.setJobStatus(job.jobId, 'failed', {
            error: errorMessage,
            ...job,
            processingTimeMs: processingTime,
            crashedDuringProcessing: true
        });

        await this.redis.lrem(this.processingKey, 1, rawData);
        await this.finishJob(workerId, rawData);

        this.emit('jobFailed', { job, error: errorMessage, processingTime });
        return true;
    }

    protected async finishJob(workerId: number, rawData: string): Promise<void> {
        const workerItem = this.workerPool.findWorkerByThreadId(workerId);
        if (workerItem) {
            workerItem.isIdle = true;
            workerItem.lastUsed = Date.now();
            this.workerPool.clearWorkerTimers(workerItem);
            this.workerPool.scheduleScaleDown(workerItem);
        }

        this.jobMap.delete(workerId);
        await this.redis.lrem(this.processingKey, 1, rawData);
    }

    // =====================
    // Job dispatching
    // =====================

    private async assignJobToWorker(workerItem: WorkerPoolItem, job: T, rawData: string): Promise<void> {
        const startTime = Date.now();
        workerItem.isIdle = false;
        this.workerPool.clearWorkerTimers(workerItem);
        workerItem.currentJobId = job.jobId;
        workerItem.startTime = startTime;
        workerItem.lastUsed = startTime;

        this.jobMap.set(workerItem.worker.threadId, { job, rawData, startTime });

        try {
            await this.jobHandler.setJobStatus(job.jobId, 'running', {
                ...job,
                workerId: workerItem.worker.threadId,
                startTime: new Date(startTime).toISOString(),
            });
            workerItem.worker.postMessage({ job });
        } catch (error) {
            workerItem.isIdle = true;
            this.jobMap.delete(workerItem.worker.threadId);
            throw error;
        }
    }

    private async dispatchJob(rawData: string): Promise<void> {
        const workers = this.workerPool.getWorkers();
        let idleWorker = workers.find((item) => item.isIdle);
        if (!idleWorker && this.workerPool.getPoolSize() < this.maxConcurrentJobs) {
            await this.workerPool.scaleUp(1);
            idleWorker = this.workerPool.getWorkers().find((item) => item.isIdle) ?? null as any;
        }

        if (!idleWorker) return;

        const job = this.deserializeJob(rawData);
        await this.assignJobToWorker(idleWorker, job, rawData);
    }

    async handleFailedJobDispatch(rawData: string): Promise<void> {
        try {
            await this.redis.multi()
                .lpush(this.queueKey, rawData)
                .lrem(this.processingKey, 1, rawData)
                .exec();
        } catch (moveError) {
            this.logError(`Critical: Failed to return job to queue: ${moveError}`);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async dispatchJobs(jobs: string[]): Promise<void> {
        for (const rawData of jobs) {
            try {
                await this.dispatchJob(rawData);
            } catch (error) {
                this.logError(`Critical error dispatching job, returning to queue: ${error}`);
                await this.handleFailedJobDispatch(rawData);
            }
        }
    }

    private async fetchJobs(count: number): Promise<string[]> {
        if (count <= 0) return [];

        const jobs: string[] = [];
        const first = await this.redisBlocking.blmove(
            this.queueKey,
            this.processingKey,
            'RIGHT',
            'LEFT',
            1
        );
        if (typeof first === 'string') jobs.push(first);

        for (let i = jobs.length; i < count; i++) {
            const j = await this.redisBlocking.lmove(this.queueKey, this.processingKey, 'RIGHT', 'LEFT');
            if (!j) break;
            jobs.push(j);
        }

        return jobs;
    }

    private async startDispatchLoop(): Promise<void> {
        this.logInfo(`Dispatcher started.`);
        let noWorkersLogCount = 0;

        while (!this.isShutdown) {
            const backlog = await this.redis.llen(this.queueKey);
            const workers = this.workerPool.getPoolSize();
            const desired = Math.min(this.maxConcurrentJobs, backlog);
            const toSpawn = Math.max(0, desired - workers);
            if (toSpawn > 0) await this.workerPool.scaleUp(toSpawn);

            const available = this.getAvailableWorkerCount();
            if (available === 0) {
                if (backlog > 0 && noWorkersLogCount % 50 === 0) {
                    this.logWarn(
                        `No workers available but ${backlog} jobs queued. ` +
                        `Pool size: ${workers}/${this.maxConcurrentJobs}. ` +
                        `Crash-loop status: ${this.workerPool.isInCrashLoopState() ? 'ACTIVE' : 'inactive'} ` +
                        `(consecutive crashes: ${this.workerPool.getConsecutiveCrashes()})`
                    );
                }
                noWorkersLogCount++;
                await this.sleep(100);
                continue;
            }

            noWorkersLogCount = 0;

            const jobsToProcess = Math.min(available, QUEUE_DEFAULTS.BATCH_SIZE);
            const jobs = await this.fetchJobs(jobsToProcess);
            if (jobs.length === 0) {
                await this.sleep(100);
                continue;
            }

            await this.dispatchJobs(jobs);
        }
    }

    private async initializeQueue(): Promise<void> {
        await this.workerPool.scaleUp(QUEUE_DEFAULTS.MIN_WORKERS);
        await this.recoveryManager.recoverOnStartup();
        await this.startDispatchLoop();
    }

    private async addJobsBatch(jobs: T[], sessionId: string, sessionStartTime: string): Promise<void> {
        const regularJobs: string[] = [];

        for (const job of jobs) {
            const serialized = JSON.stringify(job);
            regularJobs.push(serialized);
        }

        const pipeline = this.redis.pipeline();

        if (regularJobs.length > 0) {
            pipeline.lpush(this.queueKey, ...regularJobs);
        }

        await pipeline.exec();

        const statusPromises = jobs.map((job) =>
            this.jobHandler.setJobStatus(job.jobId, 'queued', {
                ...job,
                sessionId,
                sessionStartTime,
            })
        );

        await Promise.all(statusPromises);
        this.emit('jobsAdded', { count: jobs.length, regular: regularJobs.length });
    }

    protected async setJobStatus(jobId: string, status: string, data: any): Promise<void> {
        return this.jobHandler.setJobStatus(jobId, status, data);
    }
}
