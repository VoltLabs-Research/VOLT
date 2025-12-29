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

import os from 'os';
import util from 'util';
import IORedis from 'ioredis';
import { BaseJob, QueueOptions, WorkerPoolItem } from '@/types/queues/base-processing-queue';
import { createRedisClient } from '@config/redis';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { publishJobUpdate } from '@/events/job-updates';
import { Trajectory } from '@/models';
import logger from '@/logger';

export abstract class BaseProcessingQueue<T extends BaseJob> extends EventEmitter {
    protected readonly queueName: string;
    protected readonly workerPath: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly useStreamingAdd: boolean;

    protected readonly TTL: number = 24 * 60 * 60;
    protected readonly batchSize = 20;
    protected readonly minWorkers = 1;
    protected readonly idleWorkerTTL = 30000;

    readonly queueKey: string;
    readonly processingKey: string;
    readonly statusKeyPrefix: string;

    private sessionsBeingCleaned = new Set<string>();
    private workerPool: WorkerPoolItem[] = [];
    protected jobMap = new Map<number, { job: T; rawData: string; startTime: number }>();

    private isShutdown = false;
    protected redis: IORedis;
    private redisBlocking: IORedis;

    constructor(options: QueueOptions) {
        super();

        this.queueName = options.queueName;
        this.workerPath = options.workerPath;

        this.queueKey = `${this.queueName}_queue`;
        this.processingKey = `${this.queueKey}:processing`;
        this.statusKeyPrefix = `${this.queueKey}:status:`;

        this.maxConcurrentJobs = options.maxConcurrentJobs || Math.max(2, Math.floor(os.cpus().length * 0.75));
        this.useStreamingAdd = options.useStreamingAdd || false;

        const clusterId = process.env.CLUSTER_ID ? `[Cluster: ${process.env.CLUSTER_ID}] ` : '';
        this.logPrefix = `${clusterId}[${this.queueName}]`;

        this.redis = createRedisClient();
        this.redisBlocking = createRedisClient();

        this.initializeQueue();
    }

    private logPrefix: string;

    private logInfo(message: string) {
        logger.info(`${this.logPrefix} ${message}`);
    }

    private logError(message: string) {
        logger.error(`${this.logPrefix} ${message}`);
    }

    private logWarn(message: string) {
        logger.warn(`${this.logPrefix} ${message}`);
    }

    private spawnWorker(): WorkerPoolItem {
        const item: WorkerPoolItem = {
            worker: this.createWorker(),
            isIdle: true,
            jobCount: 0,
            lastUsed: Date.now(),
            timeouts: new Set()
        };

        this.workerPool.push(item);
        return item;
    };

    private async requeueStaleRunningJobs(): Promise<void> {
        let cursor = '0';
        const match = `${this.statusKeyPrefix}*`;

        do {
            const resp = await this.redis.scan(cursor, 'MATCH', match, 'COUNT', 500);
            cursor = resp[0];
            const keys: string[] = resp[1];
            if (keys.length === 0) continue;

            const pipeline = this.redis.pipeline();
            keys.forEach(k => pipeline.get(k));
            const results: any = await pipeline.exec();

            for (const [, raw] of results) {
                if (!raw) continue;
                try {
                    const data = JSON.parse(raw);
                    if (data?.status !== 'running') continue;
                    const jobObj = this.deserializeJob(JSON.stringify(data));
                    const rawData = JSON.stringify(jobObj);

                    const [inQueue, inProc] = await Promise.all([
                        this.redis.lpos(this.queueKey, rawData),
                        this.redis.lpos(this.processingKey, rawData)
                    ]);
                    if (inQueue === null && inProc === null) {
                        await this.redis.lpush(this.queueKey, rawData);
                    }

                    await this.setJobStatus(data.jobId, 'requeued_after_restart', {
                        ...jobObj,
                        note: 'Job was running during a server restart and has been requeued safely.'
                    });
                } catch (_e) {
                }
            }
        } while (cursor !== '0');
    }

    private async withStartupLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
        const lockKey = `${this.queueKey}:startup_lock`;
        const ttlMs = 60_000;
        const lockVal = `${process.pid}:${Date.now()}`;

        const lua = `
            local ok = redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX')
            if ok then return 1 else return 0 end
        `;

        const acquired = await this.redis.eval(lua, 1, lockKey, lockVal, String(ttlMs)) as number;
        if (acquired !== 1) {
            this.logInfo(`Startup recovery already running elsewhere, skipping.`);
            return;
        }

        try {
            return await fn();
        } finally {
            await this.redis.del(lockKey).catch(() => { });
        }
    }

    private async recoverOnStartup(): Promise<void> {
        await this.withStartupLock(async () => {
            await this.drainProcessingIntoQueue();
            await this.requeueStaleRunningJobs();
        });
    }

    private async drainProcessingIntoQueue(): Promise<number> {
        const lua = `
            local src = KEYS[1]
            local dst = KEYS[2]
            local moved = 0
            while true do
            local v = redis.call('RPOPLPUSH', src, dst)
            if not v then break end
            moved = moved + 1
            end
            return moved
        `;
        const moved = await this.redis.eval(lua, 2, this.processingKey, this.queueKey) as number;
        if (moved && moved > 0) {
            this.logInfo(`Recovered ${moved} jobs from processing.`);
        }
        return moved || 0;
    }

    private scheduleScaleDown(item: WorkerPoolItem) {
        const timeout = setTimeout(() => {
            if (!item.isIdle) return;
            if (this.workerPool.length <= this.minWorkers) return;

            const idx = this.workerPool.findIndex(({ worker }) => worker.threadId === item.worker.threadId);
            if (idx !== -1) {
                const [gone] = this.workerPool.splice(idx, 1);
                gone.timeouts.forEach(clearTimeout);
                gone.worker.terminate();
            }
        }, this.idleWorkerTTL);

        item.timeouts.add(timeout);
    }

    private clearWorkerTimers(item: WorkerPoolItem) {
        item.timeouts.forEach(clearTimeout);
        item.timeouts.clear();
    }

    private async scaleUp(n: number): Promise<void> {
        const canSpawn = Math.max(0, this.maxConcurrentJobs - this.workerPool.length);
        const toSpawn = Math.min(n, canSpawn);

        for (let i = 0; i < toSpawn; i++) {
            this.spawnWorker();
        }
    }

    private async executeCleanupScript(sessionId: string, trajectoryId: string, teamId: string): Promise<[number, number, string]> {
        const luaScript = `
            local sessionId = ARGV[1]
            local trajectoryId = ARGV[2]

            local sessionKey = "session:" .. sessionId
            local counterKey = sessionKey .. ":remaining"

            local remaining = redis.call('DECR', counterKey)

            if remaining <= 0 then
                redis.call('DEL', sessionKey)
                redis.call('DEL', counterKey)

                return {1, 0, "cleaned"}
            else
                return {0, remaining, "pending"}
            end
        `;

        return await this.redis.eval(
            luaScript,
            0,
            sessionId,
            trajectoryId
        ) as [number, number, string];
    }

    private async emitSessionCompleted(teamId: string, sessionId: string, trajectoryId: string): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        const sessionData = await this.redis.get(sessionKey);

        if (!sessionData) {
            logger.warn(`Session data not found for ${sessionId}`);
            return;
        }

        try {
            const session = JSON.parse(sessionData);
            const completedEvent = {
                type: 'session_completed',
                sessionId,
                trajectoryId,
                totalJobs: session.totalJobs,
                startTime: session.startTime,
                completedAt: new Date().toISOString(),
                timestamp: new Date().toISOString()
            };

            await publishJobUpdate(teamId, completedEvent);
            this.logInfo(`Session completed event emitted to team ${teamId} for trajectory ${trajectoryId}`);
        } catch (error) {
            this.logError(`Failed to emit session completed event: ${error}`);
        }
    }

    private async emitSessionExpired(teamId: string, sessionId: string, trajectoryId: string): Promise<void> {
        const expiredEvent = {
            type: 'session_expired',
            sessionId,
            trajectoryId,
            timestamp: new Date().toISOString()
        };

        await publishJobUpdate(teamId, expiredEvent);
        this.logInfo(`Session expired event emitted to team ${teamId}`);
    }

    private async checkAndCleanupSession(job: T): Promise<void> {
        if (!job.sessionId || !job.trajectoryId) return;
        if (this.sessionsBeingCleaned.has(job.sessionId)) return;

        const { sessionId, trajectoryId } = job;

        try {
            const result = await this.executeCleanupScript(sessionId, trajectoryId, job.teamId);
            const [shouldClean] = result;

            if (shouldClean === 1) {
                this.sessionsBeingCleaned.add(sessionId);
                await this.emitSessionCompleted(job.teamId, sessionId, trajectoryId);

                setTimeout(() => {
                    this.sessionsBeingCleaned.delete(sessionId);
                }, 10000);
            }
        } catch (error) {
            this.logError(`Error checking session ${sessionId}: ${error}`);
            this.sessionsBeingCleaned.delete(sessionId);
        }
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
            this.setJobStatus(job.jobId, 'queued', {
                ...job,
                sessionId,
                sessionStartTime,
            })
        );

        await Promise.all(statusPromises);
        this.emit('jobsAdded', { count: jobs.length, regular: regularJobs.length });
    }

    private async addJobsStreaming(jobs: T[], sessionId: string, sessionStartTime: string): Promise<void> {
        for (const job of jobs) {
            await this.redis.lpush(this.queueKey, JSON.stringify(job));

            await this.setJobStatus(job.jobId, 'queued', {
                ...job,
                sessionId,
                sessionStartTime,
            });

            await this.sleep(50);
        }
    }

    private async handleJobFailure(job: T, error: string, processingTime: number, rawData: string): Promise<boolean> {
        // TODO: I think retrying failed processes should be optional.
        // If it already fails, it will fail again.
        // I can't think of any reason why retrying after a failure should work.
        const maxAttempts = job.maxRetries || 1;
        const retryCountKey = `job:retries:${job.jobId}`;

        // Increment the retry counter for this job ID in Redis.
        // INCR is atomic, which prevents race conditions.
        const currentAttempt = await this.redis.incr(retryCountKey);
        await this.redis.expire(retryCountKey, this.TTL);
        /*
        if(currentAttempt < maxAttempts){
            logger.info(`[${this.queueName}] Job ${job.jobId} failed. Attempt ${currentAttempt} of ${maxAttempts}. Re-queuing.`);
            const retryJob = {
                ...job,
                retries: currentAttempt
            };

            await this.setJobStatus(job.jobId, 'retrying', {
                ...retryJob,
                error,
                processingTimeMs: processingTime
            });

            // We add the original job back to the queue for a new attempt.
            await this.redis.lpush(this.queueKey, rawData);
            this.emit('jobRetry', { job: retryJob, error, retries: currentAttempt });

            return false;
        }
        */
        // If this part of the function is executed it means that the maximum attempt has been reached.
        this.logError(`Job ${job.jobId} failed after ${maxAttempts} attempts. Removing from queue permanently.`);

        await this.setJobStatus(job.jobId, 'failed', {
            ...job,
            retries: currentAttempt,
            error,
            finalAttempt: true,
            processingTimeMs: processingTime,
        });

        await this.redis.del(retryCountKey);

        this.emit('jobFailed', { job, error, processingTime });

        return true;
    }

    protected async finishJob(workerId: number, rawData: string): Promise<void> {
        const workerIdx = this.workerPool.findIndex(({ worker }) => worker.threadId === workerId);
        if (workerIdx !== -1) {
            const item = this.workerPool[workerIdx];
            item.isIdle = true;
            item.lastUsed = Date.now();
            this.clearWorkerTimers(item);
            this.scheduleScaleDown(item);
        }

        this.jobMap.delete(workerId);
        await this.redis.lrem(this.processingKey, 1, rawData);
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
                await this.setJobStatus(job.jobId, 'running', updateData);
                this.emit('jobProgress', { job, progress: message.progress });
                return;

            case 'completed':
                await this.setJobStatus(job.jobId, 'completed', updateData);
                this.redis.expire(statusKey, this.TTL);
                this.emit('jobCompleted', { job, result: message.result, processingTime });

                await this.redis.del(retryCountKey);
                await this.checkAndCleanupSession(job);
                await this.finishJob(workerId, rawData);

                break;

            case 'failed':
                const shouldCleanupSession = await this.handleJobFailure(job, message.error, processingTime, rawData);
                if (shouldCleanupSession) {
                    this.redis.expire(statusKey, this.TTL);
                    await this.checkAndCleanupSession(job);
                }
                await this.finishJob(workerId, rawData);

                break;
        }
    }

    private createWorker(): Worker {
        const worker = new Worker(this.workerPath, {
            execArgv: [
                '-r',
                'ts-node/register',
                '-r',
                'tsconfig-paths/register'
            ],
            resourceLimits: {
                // TODO: Dynamic || max memory
                maxOldGenerationSizeMb: 30000
            }
        });

        const workerId = worker.threadId;

        worker.on('message', (message) => this.handleWorkerMessage(workerId, message));
        worker.on('error', (err: any) => this.handleWorkerError(workerId, err));
        worker.on('exit', (code) => this.handleWorkerExit(workerId, code));

        return worker;
    }

    private async markJobFailed(workerId: number, errorMessage: string): Promise<boolean> {
        const jobInfo = this.jobMap.get(workerId);
        // Worker crashed before it had a job assigned (e.g., TypeScript compilation error)
        if (!jobInfo) {
            return false;
        }

        const { job, rawData, startTime } = jobInfo;
        const processingTime = Date.now() - startTime;

        await this.setJobStatus(job.jobId, 'failed', {
            error: errorMessage,
            ...job,
            processingTimeMs: processingTime,
            crashedDuringProcessing: true
        });

        // Remove from processing list, don't add back to queue
        await this.redis.lrem(this.processingKey, 1, rawData);
        await this.finishJob(workerId, rawData);

        this.emit('jobFailed', { job, error: errorMessage, processingTime });
        return true;
    }

    private async handleWorkerError(workerId: number, err: Error): Promise<void> {
        let msg = 'Unknown error';
        try {
            if (err instanceof Error) {
                msg = err.message;
                if (err.stack) msg += `\nStack: ${err.stack}`;
            } else if (typeof err === 'string') {
                msg = err;
            } else {
                msg = util.inspect(err, { depth: null, colors: false, breakLength: Infinity });
            }
        } catch {
            msg = 'Non-inspectable error';
        }

        this.logError(`Worker #${workerId} error: ${msg}`);
        await this.markJobFailed(workerId, msg);
        this.replaceWorker(workerId);
    }

    private replaceWorker(workerId: number): void {
        const idx = this.workerPool.findIndex(({ worker }) => worker.threadId === workerId);
        if (idx !== -1) {
            const old = this.workerPool[idx];
            old.worker.terminate();
            old.timeouts.forEach(clearTimeout);
            this.workerPool.splice(idx, 1);
        }

        const backlogPromise = this.redis.llen(this.queueKey);
        backlogPromise.then((backlog) => {
            if (this.workerPool.length < this.minWorkers || backlog > 0) {
                this.spawnWorker();
            }
        }).catch(() => {
            if (this.workerPool.length < this.minWorkers) {
                this.spawnWorker();
            }
        });
    }

    private async handleWorkerExit(workerId: number, code: number): Promise<void> {
        if (code !== 0) {
            this.logError(`Worker #${workerId} exited unexpectedly with code ${code}`);
            const hadJob = await this.markJobFailed(workerId, `Worker exited with code ${code}`);
            if (!hadJob) {
                // Worker crashed before processing any job (e.g., TS compilation error)
                // No need to requeue anything, just log and replace worker
                this.logWarn(`Worker #${workerId} crashed without an assigned job (likely startup error)`);
            }
        }
        this.replaceWorker(workerId);
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

    getAvailableWorkerCount(): number {
        return this.workerPool.filter(item => item.isIdle).length;
    }

    protected abstract deserializeJob(rawData: string): T;

    private mapJobStatusToTrajectoryStatus(jobStatus: string, queueType: string): string | null {
        if (queueType.includes('analysis-processing-queue')) {
            switch (jobStatus) {
                case 'queued':
                case 'waiting':
                    return 'queued';
                case 'running':
                    return 'analyzing';
                case 'completed':
                    return 'completed';
                case 'failed':
                    return 'failed';
                default:
                    return null;
            }
        }

        if (queueType.includes('rasterizer')) {
            // Rasterizer(preview generation)
            switch (jobStatus) {
                case 'queued':
                case 'waiting':
                    return 'rendering';
                case 'running':
                    return 'rendering';
                case 'completed':
                    return 'completed';
                case 'failed':
                    return 'failed';
                default:
                    return null;
            }
        } else {
            // Trajectory processing
            switch (jobStatus) {
                case 'queued':
                case 'waiting':
                    return 'queued';
                case 'running':
                    return 'processing';
                case 'completed':
                    // When trajectory processing completes, it transitions to rendering
                    // (rasterizer job will be created next)
                    return 'rendering';
                case 'failed':
                    return 'failed';
                default:
                    return null;
            }
        }
    }

    private async setJobStatus(jobId: string, status: string, data: any): Promise<void> {
        const statusData = {
            jobId,
            status,
            timestamp: new Date().toISOString(),
            queueType: this.queueName,
            ...data
        };

        const statusKey = `${this.statusKeyPrefix}${jobId}`;
        const teamId = data.teamId;

        await this.redis.set(statusKey, JSON.stringify(statusData), 'EX', 86400);

        if (teamId) {
            const teamJobsKey = `team:${teamId}:jobs`;
            await this.redis.sadd(teamJobsKey, jobId);
        }

        // Map job status to trajectory status
        const trajectoryStatus = this.mapJobStatusToTrajectoryStatus(status, data.queueType || this.queueName);

        // Update trajectory status only on meaningful state transitions
        // and only once per session(when the first job reaches a certain status)
        if (data.trajectoryId && trajectoryStatus) {
            try {
                const trajectory = await Trajectory.findById(data.trajectoryId);
                if (!trajectory) {
                    this.logWarn(`Trajectory not found: ${data.trajectoryId}`);
                    return;
                }

                let shouldUpdate = false;
                const currentStatus = trajectory.status;

                if (status === 'queued' && currentStatus !== 'processing' && currentStatus !== 'rendering' && currentStatus !== 'completed') {
                    shouldUpdate = true;
                } else if (status === 'running') {
                    if (trajectoryStatus === 'analyzing') {
                        // 🔥 Caso especial: análisis de dislocaciones
                        // Permitimos cambiar desde cualquier estado(incluido 'completed'/'rendering')
                        shouldUpdate = true;
                    } else if (currentStatus !== 'rendering' && currentStatus !== 'completed') {
                        // Comportamiento original para el pipeline principal
                        shouldUpdate = true;

                        if (data.sessionId) {
                            const sessionRunningKey = `${data.sessionId}:first_running_job`;
                            const alreadyRunning = await this.redis.get(sessionRunningKey);
                            if (alreadyRunning) {
                                shouldUpdate = false;
                            } else {
                                await this.redis.setex(sessionRunningKey, 86400, '1');
                            }
                        }
                    }
                } else if (status === 'completed' && trajectoryStatus === 'rendering') {
                    // pipeline principal
                    if (data.sessionId) {
                        const sessionCompleteKey = `${data.sessionId}:first_complete_job`;
                        const alreadyCompleted = await this.redis.get(sessionCompleteKey);
                        if (!alreadyCompleted) {
                            await this.redis.setex(sessionCompleteKey, 86400, '1');
                            shouldUpdate = true;
                        }
                    }
                } else if (status === 'completed' && trajectoryStatus === 'completed' && currentStatus !== 'completed') {
                    // rasterizer o análisis que dejan la traj en 'completed'
                    shouldUpdate = true;
                } else if (status === 'failed' && currentStatus !== 'failed') {
                    shouldUpdate = true;
                }

                if (shouldUpdate) {
                    const updatedTrajectory = await Trajectory.findByIdAndUpdate(
                        data.trajectoryId,
                        { status: trajectoryStatus },
                        { new: true }
                    );

                    if (updatedTrajectory && teamId) {
                        await this.redis.publish('trajectory_updates', JSON.stringify({
                            trajectoryId: data.trajectoryId,
                            status: trajectoryStatus,
                            teamId,
                            updatedAt: updatedTrajectory.updatedAt,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            } catch (error) {
                this.logError(`Failed to update trajectory ${data.trajectoryId} status: ${error}`);
            }
        }

        await publishJobUpdate(teamId, statusData);
    }

    async getJobStatus(jobId: string): Promise<any | null> {
        const statusKey = `${this.statusKeyPrefix}${jobId}`;
        try {
            const statusData = await this.redis.get(statusKey);
            if (!statusData) {
                return null;
            }

            return JSON.parse(statusData);
        } catch (error) {
            this.logError(`Failed to get status for job ${jobId}: ${error}`);
            return null;
        }
    }

    private async assignJobToWorker(workerItem: WorkerPoolItem, job: T, rawData: string): Promise<void> {
        const startTime = Date.now();
        workerItem.isIdle = false;
        this.clearWorkerTimers(workerItem);
        workerItem.currentJobId = job.jobId;
        workerItem.startTime = startTime;
        workerItem.lastUsed = startTime;

        this.jobMap.set(workerItem.worker.threadId, { job, rawData, startTime });

        try {
            await this.setJobStatus(job.jobId, 'running', {
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
        let idleWorker = this.workerPool.find((item) => item.isIdle);
        if (!idleWorker && this.workerPool.length < this.maxConcurrentJobs) {
            await this.scaleUp(1);
            idleWorker = this.workerPool.find((item) => item.isIdle) ?? null as any;
        }

        // Max capacity
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
        // We use a sequential loop and not a parallel loop(map + Promise.all) to
        // avoid the race condition where multiple jobs are assigned to the same
        // worker before its state is updated to "busy"
        for (const rawData of jobs) {
            try {
                // By using 'await' here, we ensure that dispatchJob completes the
                // assignment and updates the worker's state before moving
                // on to the next job in the batch.
                await this.dispatchJob(rawData);
            } catch (error) {
                this.logError(`Critical error dispatching job, returning to queue: ${error}`);
                await this.handleFailedJobDispatch(rawData);
            }
        }
    }

    private async startDispatchLoop(): Promise<void> {
        this.logInfo(`Dispatcher started.`);

        while (!this.isShutdown) {
            const backlog = await this.redis.llen(this.queueKey);
            const workers = this.workerPool.length;
            const desired = Math.min(this.maxConcurrentJobs, backlog);
            const toSpawn = Math.max(0, desired - workers);
            if (toSpawn > 0) await this.scaleUp(toSpawn);

            const available = this.getAvailableWorkerCount();
            if (available === 0) {
                await this.sleep(100);
                continue;
            }

            const jobsToProcess = Math.min(available, this.batchSize);
            const jobs = await this.fetchJobs(jobsToProcess);
            if (jobs.length === 0) {
                await this.sleep(100);
                continue;
            }

            await this.dispatchJobs(jobs);
        }
    }

    private async initializeQueue(): Promise<void> {
        await this.scaleUp(this.minWorkers);
        await this.recoverOnStartup();
        await this.startDispatchLoop();
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    private async initializeSession(sessionId: string, sessionStartTime: string, jobCount: number, firstJob: T): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        const counterKey = `session:${sessionId}:remaining`;

        await this.redis.pipeline()
            .setex(sessionKey, 86400 * 7, JSON.stringify({
                sessionId,
                startTime: sessionStartTime,
                totalJobs: jobCount,
                trajectoryId: (firstJob as any).trajectoryId,
                teamId: firstJob.teamId,
                status: 'active'
            }))
            .set(counterKey, jobCount.toString())
            .expire(counterKey, 86400 * 7)
            .exec();
    }

    public async addJobs(jobs: T[]): Promise<void> {
        if (jobs.length === 0) return;

        const sessionId = this.generateSessionId();
        const sessionStartTime = new Date().toISOString();

        const jobsWithSession = jobs.map((job) => ({
            ...job,
            sessionId,
            sessionStartTime
        }));

        await this.initializeSession(sessionId, sessionStartTime, jobs.length, jobsWithSession[0]);

        if (this.useStreamingAdd) {
            await this.addJobsStreaming(jobsWithSession, sessionId, sessionStartTime);
        } else {
            await this.addJobsBatch(jobsWithSession, sessionId, sessionStartTime);
        }
    }
};
