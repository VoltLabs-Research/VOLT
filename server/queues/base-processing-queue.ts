import os from 'os';
import IORedis from 'ioredis';
import { BaseJob, QueueOptions, WorkerPoolItem } from '@/types/queues/base-processing-queue';
import { createRedisClient } from '@config/redis';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { emitJobUpdate } from '@/config/socket';

export abstract class BaseProcessingQueue<T extends BaseJob> extends EventEmitter{
    protected readonly queueName: string;
    protected readonly workerPath: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly useStreamingAdd: boolean;
    protected readonly TTL: number = 24 * 60 * 60;
    protected readonly batchSize = 20;

    readonly queueKey: string;
    readonly processingKey: string;
    readonly statusKeyPrefix: string;

    private sessionsBeingCleaned = new Set<string>();
    private workerPool: WorkerPoolItem[] = [];
    private jobMap = new Map<number, { job: T; rawData: string; startTime: number }>();

    private isShutdown = false;
    private redis: IORedis;

    constructor(options: QueueOptions){
        super();

        this.queueName = options.queueName;
        this.workerPath = options.workerPath;

        this.queueKey = `${this.queueName}_queue`;
        this.processingKey = `${this.queueKey}:processing`;
        this.statusKeyPrefix = `${this.queueKey}:status:`;

        this.maxConcurrentJobs = options.maxConcurrentJobs || Math.max(2, Math.floor(os.cpus().length * 0.75));
        this.useStreamingAdd = options.useStreamingAdd || false;

        this.redis = createRedisClient();
        this.initializeQueue();
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

    private emitSessionExpired(teamId: string, sessionId: string, trajectoryId: string): void {
        const expiredEvent = {
            type: 'session_expired',
            sessionId,
            trajectoryId,
            timestamp: new Date().toISOString()
        };
        
        emitJobUpdate(teamId, expiredEvent);
        console.log(`Session expired event emitted to team ${teamId}`);
    }

    private async checkAndCleanupSession(job: T): Promise<void>{
        if(!job.sessionId || !job.trajectoryId) return;
        if(this.sessionsBeingCleaned.has(job.sessionId)) return;

        const { sessionId, trajectoryId } = job;
        
        try{
            const result = await this.executeCleanupScript(sessionId, trajectoryId, job.teamId);
            const [shouldClean] = result;

            if(shouldClean === 1){
                this.sessionsBeingCleaned.add(sessionId);
                this.emitSessionExpired(job.teamId, sessionId, trajectoryId);
                
                setTimeout(() => {
                    this.sessionsBeingCleaned.delete(sessionId);
                }, 10000);
            }
        }catch(error){
            console.error(`Error checking session ${sessionId}:`, error);
            this.sessionsBeingCleaned.delete(sessionId);
        }
    }
    
    private async addJobsBatch(jobs: T[], sessionId: string, sessionStartTime: string): Promise<void> {
        const regularJobs: string[] = [];
        
        for(const job of jobs){
            const serialized = JSON.stringify(job);
            regularJobs.push(serialized);
        }
        
        const pipeline = this.redis.pipeline();
        
        if(regularJobs.length > 0){
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
        for(const job of jobs){
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

        if(currentAttempt < maxAttempts){
            console.log(`[${this.queueName}] Job ${job.jobId} failed. Attempt ${currentAttempt} of ${maxAttempts}. Re-queuing.`);
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

        // If this part of the function is executed it means that the maximum attempt has been reached.
        console.error(`[${this.queueName}] Job ${job.jobId} failed after ${maxAttempts} attempts. Removing from queue permanently.`);
            
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

    private async finishJob(workerId: number, rawData: string): Promise<void>{
        const workerIdx = this.workerPool.findIndex(({ worker }) => worker.threadId === workerId);
        if(workerIdx !== -1){
            this.workerPool[workerIdx].isIdle = true;
            this.workerPool[workerIdx].lastUsed = Date.now();
        }

        this.jobMap.delete(workerIdx);

        await this.redis.lrem(this.processingKey, 1, rawData);
    }

    private async handleWorkerMessage(workerId: number, message: any): Promise<void>{
        const jobInfo = this.jobMap.get(workerId);
        if(!jobInfo) return;

        const { job, rawData, startTime } = jobInfo;
        const processingTime = Date.now() - startTime;
        const statusKey = `${this.statusKeyPrefix}${job.jobId}`;
        const retryCountKey = `job:retries:${job.jobId}`;
        const updateData = {
            ...job,
            progress: message.progress,
            processingTimeMs: processingTime,
        };

        switch(message.status){
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
                if(shouldCleanupSession){
                    this.redis.expire(statusKey, this.TTL);
                    await this.checkAndCleanupSession(job);
                }
                await this.finishJob(workerId, rawData);

                break;
        }
    }

    private createWorker(): Worker{
        const worker = new Worker(this.workerPath, {
            execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
        });

        worker.on('message', (message) => this.handleWorkerMessage(worker.threadId, message));
        worker.on('error', (err) => this.handleWorkerError(worker.threadId, err));
        worker.on('exit', (code) => this.handleWorkerExit(worker.threadId, code));
        
        return worker;
    }

    private async requeueJob(workerId: number, errorMessage: string): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if(!jobInfo) return;

        const { job, rawData } = jobInfo;
        await this.setJobStatus(job.jobId, 'queued_after_failure', { error: errorMessage, ...job });
        await this.redis.multi()
            .lpush(this.queueKey, rawData)
            .lrem(this.processingKey, 1, rawData)
            .exec();

        await this.finishJob(workerId, rawData);
    }

    private async handleWorkerError(workerId: number, err: Error): Promise<void> {
        console.error(`[${this.queueName}] Worker #${workerId} error:`, err);
        await this.requeueJob(workerId, err.message);
        this.replaceWorker(workerId);
    }

    private replaceWorker(workerId: number): void {
        const workerIndex = this.workerPool.findIndex(item => item.worker.threadId === workerId);
        
        if(workerIndex !== -1){
            const oldWorker = this.workerPool[workerIndex];
            oldWorker.worker.terminate();
            
            this.workerPool[workerIndex] = {
                worker: this.createWorker(),
                isIdle: true,
                jobCount: 0,
                lastUsed: Date.now(),
                timeouts: new Set()
            };
            
            console.log(`[${this.queueName}] Replaced worker #${workerId} with new worker #${this.workerPool[workerIndex].worker.threadId}`);
        }
    }

    private handleWorkerExit(workerId: number, code: number): void {
        if(code !== 0){
            console.error(`[${this.queueName}] Worker #${workerId} exited unexpectedly with code ${code}`);
            this.requeueJob(workerId, `Worker exited with code ${code}`);
        }
        this.replaceWorker(workerId);
    }

    private async fetchJobs(count: number): Promise<string[]>{
        if(count <= 0) return [];
        
        const jobs: string[] = [];
        const pipeline = this.redis.pipeline();

        for(let i = 0; i < count; i++){
            pipeline.blmove(this.queueKey, this.processingKey, 'RIGHT', 'LEFT', 0.1);
        }

        const results = await pipeline.exec();
        if(results){
            for(const result of results){
                if(result && result[1] && typeof result[1] === 'string'){
                    jobs.push(result[1]);
                }
            }
        }
        
        return jobs;
    }

    getAvailableWorkerCount(): number {
        return this.workerPool.filter(item => item.isIdle).length;
    }

    protected abstract deserializeJob(rawData: string): T;

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

        if(teamId){
            const teamJobsKey = `team:${teamId}:jobs`;
            await this.redis.sadd(teamJobsKey, jobId);
        }

        await emitJobUpdate(teamId, statusData);
    }

    async getJobStatus(jobId: string): Promise<any | null>{
        const statusKey = `${this.statusKeyPrefix}${jobId}`;
        try{
            const statusData = await this.redis.get(statusKey);
            if(!statusData){
                return null;
            }

            return JSON.parse(statusData);
        }catch(error){
            console.error(`[${this.queueName}] Failed to get status for job ${jobId}:`, error);
            return null;
        }
    }

    private async assignJobToWorker(workerItem: WorkerPoolItem, job: T, rawData: string): Promise<void> {
        const startTime = Date.now();
        workerItem.isIdle = false;
        workerItem.currentJobId = job.jobId;
        workerItem.startTime = startTime;
        workerItem.lastUsed = startTime;

        this.jobMap.set(workerItem.worker.threadId, { job, rawData, startTime });

        try{
            await this.setJobStatus(job.jobId, 'running', {
                ...job,
                workerId: workerItem.worker.threadId,
                startTime: new Date(startTime).toISOString(),
            });
            workerItem.worker.postMessage({ job });
        }catch(error){
            workerItem.isIdle = true;
            this.jobMap.delete(workerItem.worker.threadId);
            throw error;
        }
    }

    private async dispatchJob(rawData: string): Promise<void>{
        const idleWorker = this.workerPool.find((item) => item.isIdle);
        if(!idleWorker) return;

        const job = this.deserializeJob(rawData);
        await this.assignJobToWorker(idleWorker, job, rawData);
    }

    async handleFailedJobDispatch(rawData: string): Promise<void> {
        try{
            await this.redis.multi()
                .lpush(this.queueKey, rawData)
                .lrem(this.processingKey, 1, rawData)
                .exec();
        }catch(moveError){
            console.error(`Critical: Failed to return job to queue:`, moveError);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async dispatchJobs(jobs: string[]): Promise<void>{
        // We use a sequential loop and not a parallel loop (map + Promise.all) to
        // avoid the race condition where multiple jobs are assigned to the same
        // worker before its state is updated to "busy"
        for(const rawData of jobs){
            try{
                // By using 'await' here, we ensure that dispatchJob completes the
                // assignment and updates the worker's state before moving
                // on to the next job in the batch.
                await this.dispatchJob(rawData);
            }catch(error){
                console.error(`[${this.queueName}] Critical error dispatching job, returning to queue.`, error);
                await this.handleFailedJobDispatch(rawData);
            }
        }
    }

    private async startDispatchLoop(): Promise<void>{
        console.log(`[${this.queueName}] Dispatcher started.`);

        while(!this.isShutdown){
            // Process available jobs
            const availableWorkers = this.getAvailableWorkerCount();
            if(availableWorkers === 0){
                await this.sleep(100);
                continue;
            }

            const jobsToProcess = Math.min(availableWorkers, this.batchSize);
            const jobs = await this.fetchJobs(jobsToProcess);

            if(jobs.length === 0){
                await this.sleep(100);
                continue;
            }

            await this.dispatchJobs(jobs);
        }
    }

    private async initializeQueue(): Promise<void>{
        // Initialize workers
        for(let i = 0; i < this.maxConcurrentJobs; i++){
            this.workerPool.push({
                worker: this.createWorker(),
                isIdle: true,
                jobCount: 0,
                lastUsed: Date.now(),
                timeouts: new Set()
            });
        }

        // Start job dispatcher
        await this.startDispatchLoop();
    }

    private generateSessionId(): string{
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

    public async addJobs(jobs: T[]): Promise<void>{
        if(jobs.length === 0) return;

        const sessionId = this.generateSessionId();
        const sessionStartTime = new Date().toISOString();

        const jobsWithSession = jobs.map((job) => ({
            ...job,
            sessionId,
            sessionStartTime
        }));

        await this.initializeSession(sessionId, sessionStartTime, jobs.length, jobsWithSession[0]);

        if(this.useStreamingAdd){
            await this.addJobsStreaming(jobsWithSession, sessionId, sessionStartTime);
        }else{
            await this.addJobsBatch(jobsWithSession, sessionId, sessionStartTime);
        }
    }
};