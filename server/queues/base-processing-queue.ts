import { BaseJob, WorkerPoolItem, QueueMetrics, QueueOptions, CircuitBreaker } from '@/types/queues/base-processing-queue';
import { createRedisClient, redis } from '@config/redis';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { emitJobUpdate } from '@/config/socket';
import os from 'os';
import IORedis from 'ioredis';

export abstract class BaseProcessingQueue<T extends BaseJob> extends EventEmitter {
    protected readonly queueName: string;
    protected readonly workerPath: string;
    protected readonly queueKey: string;
    protected readonly processingKey: string;
    protected readonly statusKeyPrefix: string;
    protected readonly priorityQueueKey: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly cpuLoadThreshold: number;
    protected readonly ramLoadThreshold: number;
    protected readonly workerIdleTimeout: number;
    protected readonly jobTimeout: number;
    protected readonly enableMetrics: boolean;
    protected readonly healthCheckInterval: number;
    protected readonly gracefulShutdownTimeout: number;
    protected readonly numCpus: number;
    protected readonly useStreamingAdd: boolean;
    
    protected workerPool: WorkerPoolItem[] = [];
    protected jobMap = new Map<number, { job: T; rawData: string; startTime: number }>();
    protected isShutdown = false;
    protected isPaused = false;
    protected redisListenerClient: IORedis;
    protected dispatcherPromise?: Promise<void>;
    protected healthCheckInterval_: NodeJS.Timeout | null = null;
    protected metrics: QueueMetrics;
    
    private readonly batchSize = 20;
    private readonly dispatchBackoff = {
        initial: 50,
        max: 5000,
        current: 50,
        multiplier: 1.5
    };

    private readonly circuitBreaker: CircuitBreaker = {
        failures: 0,
        lastFailure: 0,
        threshold: 5,
        timeout: 30000,
        isOpen(): boolean {
            return this.failures >= this.threshold && 
                   (Date.now() - this.lastFailure) < this.timeout;
        },
        recordFailure(): void {
            this.failures++;
            this.lastFailure = Date.now();
        },
        reset(): void {
            this.failures = 0;
        }
    };

    constructor(options: QueueOptions){
        super();
        
        this.queueName = options.queueName;
        this.workerPath = options.workerPath;
        this.queueKey = `${this.queueName}_queue`;
        this.processingKey = `${this.queueKey}:processing`;
        this.statusKeyPrefix = `${this.queueKey}:status:`;
        this.priorityQueueKey = `${this.queueKey}:priority`;
        this.maxConcurrentJobs = options.maxConcurrentJobs || Math.max(2, Math.floor(os.cpus().length * 0.75));
        this.cpuLoadThreshold = options.cpuLoadThreshold || 85;
        this.useStreamingAdd = options.useStreamingAdd || false;
        this.ramLoadThreshold = options.ramLoadThreshold || 90;
        this.workerIdleTimeout = options.workerIdleTimeout || 300000;
        this.jobTimeout = options.jobTimeout || 900000;
        this.enableMetrics = options.enableMetrics !== false;
        this.healthCheckInterval = options.healthCheckInterval || 30000;
        this.gracefulShutdownTimeout = options.gracefulShutdownTimeout || 30000; 
        this.numCpus = os.cpus().length;
        this.redisListenerClient = createRedisClient();

        this.metrics = {
            totalJobsProcessed: 0,
            totalJobsFailed: 0,
            averageProcessingTimeMs: 0,
            peakMemoryUsageMB: 0,
            workerRestarts: 0,
            lastHealthCheck: new Date().toISOString()
        };

        this.initializeQueue();
    }

    private async initializeQueue(): Promise<void> {
        try{
            console.log(`[${this.queueName}] Initializing optimized queue...`);
            
            this.initializeWorkerPool();
            this.startDispatchingJobs();
            
            if(this.enableMetrics){
                this.startHealthChecking();
            }
            
            this.setupGracefulShutdown();
            
            console.log(`[${this.queueName}] Queue initialization complete.`);
        }catch(error){
            console.error(`[${this.queueName}] Failed to initialize queue:`, error);
            throw error;
        }
    }

    private async startDispatchingJobs(): Promise<void> {
        this.dispatcherPromise = this.dispatchLoop();
    }

    private async dispatchLoop(): Promise<void> {
        console.log(`[${this.queueName}] High-performance dispatcher started.`);
        
        while(!this.isShutdown){
            try{
                if(this.isPaused){
                    await this.sleep(1000);
                    continue;
                }

                if(this.circuitBreaker.isOpen()){
                    await this.sleep(this.circuitBreaker.timeout / 10);
                    continue;
                }

                const loadCheck = this.isServerOverloaded();
                if(loadCheck.overloaded){
                    await this.sleep(this.dispatchBackoff.current);
                    this.dispatchBackoff.current = Math.min(
                        this.dispatchBackoff.current * this.dispatchBackoff.multiplier, 
                        this.dispatchBackoff.max
                    );
                    continue;
                }

                const availableWorkers = this.workerPool.filter(item => item.isIdle).length;
                if(availableWorkers === 0){
                    await this.sleep(100);
                    continue;
                }

                const jobsToProcess = Math.min(availableWorkers, this.batchSize);
                const jobs = await this.getJobsFromQueues(jobsToProcess);

                if(jobs.length === 0){
                    this.dispatchBackoff.current = Math.min(
                        this.dispatchBackoff.current * 1.2, 
                        this.dispatchBackoff.max
                    );
                    await this.sleep(this.dispatchBackoff.current);
                    continue;
                }

                this.dispatchBackoff.current = this.dispatchBackoff.initial;
                this.circuitBreaker.reset();

                const promises: Promise<void>[] = [];
                for(const rawData of jobs){
                    if(this.isShutdown) break;
                    
                    try{
                        const job = this.deserializeJob(rawData);
                        promises.push(this.dispatchJobToWorker(job, rawData));
                    }catch(error){
                        await this.handleFailedJobDispatch(rawData, error);
                    }
                }

                await Promise.allSettled(promises);
                await this.sleep(25);

            } catch(err){
                if(this.isShutdown || (err instanceof Error && err.message.includes('Connection is closed'))){
                    break;
                }

                this.circuitBreaker.recordFailure();
                console.error(`[${this.queueName}] Dispatcher error:`, err);
                await this.sleep(Math.min(this.circuitBreaker.failures * 1000, 10000));
            }
        }
        
        console.log(`[${this.queueName}] Dispatcher stopped.`);
    }

    private async getJobsFromQueues(count: number): Promise<string[]> {
        const jobs: string[] = [];
        
        const priorityJobs = await this.getJobsFromQueue(this.priorityQueueKey, Math.min(count, 5));
        jobs.push(...priorityJobs);
        
        if(jobs.length < count){
            const regularJobs = await this.getJobsFromQueue(this.queueKey, count - jobs.length);
            jobs.push(...regularJobs);
        }
        
        return jobs;
    }

    private async getJobsFromQueue(queueKey: string, count: number): Promise<string[]> {
        const jobs: string[] = [];
        const pipeline = redis!.pipeline();
        
        for(let i = 0; i < count; i++){
            pipeline.blmove(queueKey, this.processingKey, 'RIGHT', 'LEFT', 0.1);
        }
        
        try{
            const results = await pipeline.exec();
            if(results){
                for(const result of results){
                    if(result && result[1] && typeof result[1] === 'string'){
                        jobs.push(result[1]);
                    }
                }
            }
        }catch(error){
            console.error(`[${this.queueName}] Redis pipeline error:`, error);
        }
        
        return jobs;
    }

    private async handleFailedJobDispatch(rawData: string, error: any): Promise<void> {
        try{
            await redis!.multi()
                .lpush(this.queueKey, rawData)
                .lrem(this.processingKey, 1, rawData)
                .exec();
        } catch(moveError){
            console.error(`[${this.queueName}] Critical: Failed to return job to queue:`, moveError);
        }
    }

    private async dispatchJobToWorker(job: T, rawData: string): Promise<void> {
        const availableWorkerItem = this.getBestAvailableWorker();
        
        if(!availableWorkerItem){
            await redis!.multi()
                .lpush(this.queueKey, rawData)
                .lrem(this.processingKey, 1, rawData)
                .exec();
            return;
        }

        const startTime = Date.now();
        availableWorkerItem.isIdle = false;
        availableWorkerItem.currentJobId = job.jobId;
        availableWorkerItem.startTime = startTime;
        availableWorkerItem.lastUsed = startTime;
        
        this.jobMap.set(availableWorkerItem.worker.threadId, { job, rawData, startTime });
        
        const timeout = setTimeout(() => {
            this.handleJobTimeout(availableWorkerItem.worker.threadId, job.jobId);
        }, this.jobTimeout);
        
        availableWorkerItem.timeouts.add(timeout);
        
        try{
            await this.setJobStatus(job.jobId, 'running', { 
                workerId: availableWorkerItem.worker.threadId,
                startTime: new Date(startTime).toISOString(),
                teamId: job.teamId
            });
            
            availableWorkerItem.worker.postMessage({ job });
        }catch(error){
            this.clearWorkerTimeouts(availableWorkerItem);
            availableWorkerItem.isIdle = true;
            this.jobMap.delete(availableWorkerItem.worker.threadId);
            throw error;
        }
    }

    private getBestAvailableWorker(): WorkerPoolItem | undefined {
        const idleWorkers = this.workerPool.filter(item => item.isIdle);
        
        if(idleWorkers.length === 0) return undefined;
        
        return idleWorkers.reduce((best, current) => {
            if(current.jobCount < best.jobCount) return current;
            if(current.jobCount === best.jobCount && current.lastUsed < best.lastUsed) return current;
            return best;
        });
    }

    private async handleJobTimeout(workerId: number, jobId: string): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if(jobInfo && jobInfo.job.jobId === jobId){
            console.warn(`[${this.queueName}] Job ${jobId} timed out, terminating worker #${workerId}`);
            await this.handleWorkerError(workerId, new Error(`Job ${jobId} timed out after ${this.jobTimeout}ms`));
        }
    }

    private async handleWorkerMessage(workerId: number, message: any): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if(!jobInfo) return;

        const { job, rawData, startTime } = jobInfo;
        const processingTime = Date.now() - startTime;
        const workerItem = this.workerPool.find(item => item.worker.threadId === workerId);
        
        if(workerItem){
            this.clearWorkerTimeouts(workerItem);
        }
        
        try{
            switch(message.status){
                case 'completed':
                    await this.setJobStatus(job.jobId, 'completed', { 
                        result: message.result,
                        processingTimeMs: processingTime,
                        teamId: job.teamId
                    });
                    this.updateMetrics(processingTime, false);
                    this.emit('jobCompleted', { job, result: message.result, processingTime });
                    break;

                case 'failed':
                    await this.handleJobFailure(job, message.error, processingTime);
                    break;

                case 'progress':
                    await this.setJobStatus(job.jobId, 'running', { 
                        progress: message.progress,
                        processingTimeMs: processingTime,
                        teamId: job.teamId
                    });
                    this.emit('jobProgress', { job, progress: message.progress });
                    return;
            }

            if(message.status === 'completed' || message.status === 'failed'){
                await redis!.lrem(this.processingKey, 1, rawData);
                this.releaseWorker(workerId);
            }
        }catch(error){
            console.error(`[${this.queueName}] Error handling worker message:`, error);
            this.releaseWorker(workerId);
        }
    }

    private clearWorkerTimeouts(workerItem: WorkerPoolItem): void {
        for(const timeout of workerItem.timeouts){
            clearTimeout(timeout);
        }
        workerItem.timeouts.clear();
    }

    private async handleJobFailure(job: T, error: string, processingTime: number): Promise<void> {
        const retries = job.retries || 0;
        const maxRetries = job.maxRetries || 3;
        
        if(retries < maxRetries){
            const retryJob = { ...job, retries: retries + 1 };
            await this.addJobs([retryJob]);
            await this.setJobStatus(job.jobId, 'retrying', { 
                error,
                retries: retries + 1,
                maxRetries,
                processingTimeMs: processingTime,
                teamId: job.teamId
            });
            this.emit('jobRetry', { job: retryJob, error, attempt: retries + 1 });
        } else {
            await this.setJobStatus(job.jobId, 'failed', { 
                error,
                finalAttempt: true,
                processingTimeMs: processingTime,
                teamId: job.teamId
            });
            this.updateMetrics(processingTime, true);
            this.emit('jobFailed', { job, error, processingTime });
        }
    }

    private releaseWorker(workerId: number): void {
        const workerItem = this.workerPool.find(item => item.worker.threadId === workerId);
        if(workerItem){
            this.clearWorkerTimeouts(workerItem);
            workerItem.isIdle = true;
            workerItem.currentJobId = undefined;
            workerItem.startTime = undefined;
            workerItem.lastUsed = Date.now();
            workerItem.jobCount++;
        }
        this.jobMap.delete(workerId);
    }

    private async handleWorkerError(workerId: number, err: Error): Promise<void> {
        console.error(`[${this.queueName}] Worker #${workerId} error:`, err);
        await this.requeueJob(workerId, err.message);
        this.replaceWorker(workerId);
    }

    private handleWorkerExit(workerId: number, code: number): void {
        console.log(`[${this.queueName}] Worker #${workerId} exited with code ${code}`);
        
        if(code !== 0){
            const errorMessage = `Worker #${workerId} exited unexpectedly with code ${code}`;
            this.requeueJob(workerId, errorMessage);
        }
        
        this.replaceWorker(workerId);
    }

    private async requeueJob(workerId: number, errorMessage: string): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if(jobInfo){
            const { job, rawData } = jobInfo;
            
            try{
                await redis!.multi()
                    .lpush(this.queueKey, rawData)
                    .lrem(this.processingKey, 1, rawData)
                    .exec();
                
                await this.setJobStatus(job.jobId, 'queued_after_failure', { error: errorMessage, teamId: job.teamId });
                console.log(`[${this.queueName}] Requeued job ${job.jobId} due to worker failure`);
            }catch(error){
                console.error(`[${this.queueName}] Failed to requeue job:`, error);
            }
            
            this.jobMap.delete(workerId);
        }
    }

    private replaceWorker(workerId: number): void {
        const workerIndex = this.workerPool.findIndex(item => item.worker.threadId === workerId);
        
        if(workerIndex !== -1){
            const oldWorker = this.workerPool[workerIndex];
            this.clearWorkerTimeouts(oldWorker);
            oldWorker.worker.terminate();
            
            this.workerPool[workerIndex] = this.createWorkerItem();
            this.metrics.workerRestarts++;
            
            console.log(`[${this.queueName}] Replaced worker #${workerId} with new worker #${this.workerPool[workerIndex].worker.threadId}`);
        }
    }

    public async addJobs(jobs: T[], teamId: string): Promise<void> {
        if(jobs.length === 0) return;

        if(this.useStreamingAdd){
            // Streaming behavior (one by one)
            console.log(`[${this.queueName}] Adding ${jobs.length} jobs to queue using streaming mode...`);
            for(const job of jobs){
                const stringifiedJob = JSON.stringify(job);
                await redis!.lpush(this.queueKey, stringifiedJob);

                await this.setJobStatus(job.jobId, 'queued', {
                    ...(job as any).chunkIndex !== undefined && { chunkIndex: (job as any).chunkIndex },
                    ...(job as any).totalChunks !== undefined && { totalChunks: (job as any).totalChunks },
                    teamId: job.teamId
                });

                // Small pause to avoid overloading the event loop
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            console.log(`[${this.queueName}] Successfully added all jobs via streaming.`);
        }else{
            // Batch mode
            console.log(`[${this.queueName}] Adding ${jobs.length} jobs to queue using batch mode...`);

            const pipeline = redis!.pipeline();
            const statusPipeline = redis!.pipeline();
            const priorityJobs: string[] = [];
            const regularJobs: string[] = [];
            
            for(const job of jobs){
                const serialized = JSON.stringify(job);
                
                // TODO: priority?
                if(job.priority && job.priority > 5){
                    priorityJobs.push(serialized);
                } else {
                    regularJobs.push(serialized);
                }
                
                statusPipeline.setex(
                    `${this.statusKeyPrefix}${job.jobId}`,
                    86400,
                    JSON.stringify({
                        jobId: job.jobId,
                        status: 'queued',
                        timestamp: new Date().toISOString(),
                        teamId
                    })
                );
            }
            
            if(priorityJobs.length > 0){
                pipeline.lpush(this.priorityQueueKey, ...priorityJobs);
            }
            if(regularJobs.length > 0){
                pipeline.lpush(this.queueKey, ...regularJobs);
            }
            
            await Promise.all([pipeline.exec(), statusPipeline.exec()]);
            
            this.emit('jobsAdded', { count: jobs.length, priority: priorityJobs.length, regular: regularJobs.length });
            console.log(`[${this.queueName}] Added ${jobs.length} jobs (${priorityJobs.length} priority, ${regularJobs.length} regular)`);
        }
    }

    protected async setJobStatus(jobId: string, status: string, data: any = {}): Promise<void> {
        const jobInfoFromMap = Array.from(this.jobMap.values()).find((info) => info.job.jobId === jobId);

        const statusData = {
            jobId,
            status,
            timestamp: new Date().toISOString(),
            teamId: data.teamId || jobInfoFromMap?.job.teamId, 
            ...data
        };

        try{
            await redis!.setex(
                `${this.statusKeyPrefix}${jobId}`,
                86400, 
                JSON.stringify(statusData)
            );

            if(statusData.teamId){
                emitJobUpdate(statusData.teamId, statusData);
            }
        }catch(err){
            console.error(`[${this.queueName}] Failed to set job status for ${jobId}:`, err);
        }
    }

    protected abstract deserializeJob(rawData: string): T;

    private initializeWorkerPool(): void {
        console.log(`[${this.queueName}] Initializing worker pool with ${this.maxConcurrentJobs} workers.`);

        for(let i = 0; i < this.maxConcurrentJobs; i++){
            this.workerPool.push(this.createWorkerItem());
        }
        
        this.startWorkerCleanup();
    }

    private createWorkerItem(): WorkerPoolItem {
        return {
            worker: this.createWorker(),
            isIdle: true,
            jobCount: 0,
            lastUsed: Date.now(),
            timeouts: new Set()
        };
    }

    private createWorker(): Worker {
        const worker = new Worker(this.workerPath, {
            execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
        });

        worker.on('message', (message) => this.handleWorkerMessage(worker.threadId, message));
        worker.on('error', (err) => this.handleWorkerError(worker.threadId, err));
        worker.on('exit', (code) => this.handleWorkerExit(worker.threadId, code));
        
        return worker;
    }

    private startWorkerCleanup(): void {
        setInterval(() => {
            if(this.isShutdown || this.workerPool.length <= 1) return;
            
            const now = Date.now();
            const workersToRemove: number[] = [];
            
            for(let i = 0; i < this.workerPool.length; i++){
                const item = this.workerPool[i];
                if(item.isIdle && (now - item.lastUsed) > this.workerIdleTimeout){
                    workersToRemove.push(i);
                }
            }
            
            if(workersToRemove.length > 0 && this.workerPool.length - workersToRemove.length >= 1){
                for(let i = workersToRemove.length - 1; i >= 0; i--){
                    const index = workersToRemove[i];
                    const item = this.workerPool[index];
                    this.clearWorkerTimeouts(item);
                    item.worker.terminate();
                    this.workerPool.splice(index, 1);
                }
                console.log(`[${this.queueName}] Cleaned up ${workersToRemove.length} idle workers`);
            }
        }, this.workerIdleTimeout / 3);
    }

    private startHealthChecking(): void {
        this.healthCheckInterval_ = setInterval(async () => {
            try{
                await this.performHealthCheck();
            }catch(error){
                console.error(`[${this.queueName}] Health check failed:`, error);
            }
        }, this.healthCheckInterval);
    }

    private async performHealthCheck(): Promise<void> {
        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        this.metrics.peakMemoryUsageMB = Math.max(this.metrics.peakMemoryUsageMB, currentMemory);
        this.metrics.lastHealthCheck = new Date().toISOString();
        
        const now = Date.now();
        for(const [workerId, jobInfo] of this.jobMap.entries()){
            const processingTime = now - jobInfo.startTime;
            if(processingTime > this.jobTimeout * 0.9){
                console.warn(`[${this.queueName}] Job ${jobInfo.job.jobId} on worker #${workerId} approaching timeout`);
            }
        }
        
        this.emit('healthCheck', this.metrics);
    }

    private updateMetrics(processingTime: number, failed: boolean): void {
        if(!this.enableMetrics) return;
        
        if(failed){
            this.metrics.totalJobsFailed++;
        } else {
            this.metrics.totalJobsProcessed++;
        }
        
        const totalJobs = this.metrics.totalJobsProcessed + this.metrics.totalJobsFailed;
        this.metrics.averageProcessingTimeMs = 
            (this.metrics.averageProcessingTimeMs * (totalJobs - 1) + processingTime) / totalJobs;
    }

    public async getStatus(){
        try{
            const results = await redis!.multi()
                .llen(this.queueKey)
                .llen(this.processingKey)
                .llen(this.priorityQueueKey)
                .exec();

            const pendingJobs = (results?.[0]?.[1] as number) || 0;
            const processingJobs = (results?.[1]?.[1] as number) || 0;
            const priorityJobs = (results?.[2]?.[1] as number) || 0;
            const activeWorkers = this.workerPool.filter(item => !item.isIdle).length;
            const serverLoad = this.isServerOverloaded();

            return {
                queueName: this.queueName,
                maxConcurrent: this.maxConcurrentJobs,
                activeWorkers,
                totalWorkers: this.workerPool.length,
                pendingJobs: pendingJobs + priorityJobs,
                processingJobs,
                priorityJobs,
                serverLoad,
                metrics: this.enableMetrics ? this.metrics : null,
                isPaused: this.isPaused,
                circuitBreaker: {
                    isOpen: this.circuitBreaker.isOpen(),
                    failures: this.circuitBreaker.failures
                }
            };
        }catch(error){
            console.error(`[${this.queueName}] Failed to get status:`, error);
            return null;
        }
    }

    private isServerOverloaded(): { overloaded: boolean, cpu: number, ram: number } {
        const loadAvg = os.loadavg()[0];
        const cpuUsage = (loadAvg / this.numCpus) * 100;
        
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const ramUsage = (usedMem / totalMem) * 100;
        
        const overloaded = cpuUsage > this.cpuLoadThreshold || ramUsage > this.ramLoadThreshold;

        return { 
            overloaded, 
            cpu: Math.round(cpuUsage * 100) / 100, 
            ram: Math.round(ramUsage * 100) / 100
        };
    }

    public pause(): void {
        this.isPaused = true;
        console.log(`[${this.queueName}] Queue paused`);
        this.emit('paused');
    }

    public resume(): void {
        this.isPaused = false;
        console.log(`[${this.queueName}] Queue resumed`);
        this.emit('resumed');
    }

    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            console.log(`[${this.queueName}] Received ${signal}, initiating graceful shutdown...`);
            await this.shutdown();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    public async shutdown(): Promise<void> {
        console.log(`[${this.queueName}] Starting graceful shutdown...`);
        
        this.isShutdown = true;
        this.emit('shutdown');
        
        if(this.healthCheckInterval_){
            clearInterval(this.healthCheckInterval_);
        }
        
        const shutdownStart = Date.now();
        while(this.jobMap.size > 0 && (Date.now() - shutdownStart) < this.gracefulShutdownTimeout){
            console.log(`[${this.queueName}] Waiting for ${this.jobMap.size} jobs to complete...`);
            await this.sleep(1000);
        }
        
        console.log(`[${this.queueName}] Terminating ${this.workerPool.length} workers...`);
        const terminatePromises = this.workerPool.map(item => {
            this.clearWorkerTimeouts(item);
            return item.worker.terminate().catch(() => {});
        });
        
        await Promise.allSettled(terminatePromises);
        this.redisListenerClient.disconnect();
        
        console.log(`[${this.queueName}] Graceful shutdown complete.`);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}