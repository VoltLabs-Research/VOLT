import { BaseJob, QueueOptions, CircuitBreaker } from '@/types/queues/base-processing-queue';
import { createRedisClient } from '@config/redis';
import { EventEmitter } from 'events';
import { emitJobUpdate } from '@/config/socket';
import { QueueManager } from './components/queue-manager';
import { WorkerPoolManager } from './components/worker-pool-manager';
import { SessionManager } from './components/session-manager';
import { JobDispatcher } from './components/job-dispatcher';
import { LoadMonitor } from './components/load-monitor';
import { MetricsCollector } from './components/metrics-collector';
import { JobStatusManager } from './components/job-status-manager';
import os from 'os';
import IORedis from 'ioredis';

export abstract class BaseProcessingQueue<T extends BaseJob> extends EventEmitter {
    protected readonly queueName: string;
    protected readonly workerPath: string;
    readonly queueKey: string;
    readonly processingKey: string;
    readonly statusKeyPrefix: string;
    readonly priorityQueueKey: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly cpuLoadThreshold: number;
    protected readonly ramLoadThreshold: number;
    protected readonly workerIdleTimeout: number;
    protected readonly jobTimeout: number;
    protected readonly enableMetrics: boolean;
    protected readonly healthCheckInterval: number;
    protected readonly gracefulShutdownTimeout: number;
    protected readonly useStreamingAdd: boolean;

    private isShutdown = false;
    private isPaused = false;
    private redisListenerClient: IORedis;
    private jobMap = new Map<number, { job: T; rawData: string; startTime: number }>();

    private queueManager: QueueManager;
    private workerManager: WorkerPoolManager<T>;
    private sessionManager: SessionManager<T>;
    private jobDispatcher: JobDispatcher<T>;
    private loadMonitor: LoadMonitor;
    private metricsCollector: MetricsCollector;
    private jobStatusManager: JobStatusManager<T>;

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

    constructor(options: QueueOptions) {
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
        this.redisListenerClient = createRedisClient();

        this.initializeComponents();
        this.initializeQueue();
    }

    private initializeComponents(): void {
        this.queueManager = new QueueManager(this.redisListenerClient, {
            queueKey: this.queueKey,
            processingKey: this.processingKey,
            priorityQueueKey: this.priorityQueueKey
        });

        this.loadMonitor = new LoadMonitor(this.cpuLoadThreshold, this.ramLoadThreshold);

        this.metricsCollector = new MetricsCollector(
            this.enableMetrics,
            this.healthCheckInterval,
            this.jobTimeout,
            this.queueName,
            this.jobMap
        );

        this.jobStatusManager = new JobStatusManager(
            this.redisListenerClient,
            this.statusKeyPrefix,
            this.jobMap,
            this.queueName
        );

        this.workerManager = new WorkerPoolManager(
            this.workerPath,
            this.maxConcurrentJobs,
            this.jobTimeout,
            this.workerIdleTimeout,
            (rawData) => this.deserializeJob(rawData),
            (workerId, message) => this.handleWorkerMessage(workerId, message),
            () => this.metricsCollector.incrementWorkerRestarts(),
            this.queueName,
            (jobId, status, data) => this.jobStatusManager.setJobStatus(jobId, status, data)
        );

        this.sessionManager = new SessionManager(
            this.redisListenerClient,
            (teamId, sessionId, trajectoryId) => this.emitSessionExpired(teamId, sessionId, trajectoryId)
        );

        this.jobDispatcher = new JobDispatcher(
            this.queueManager,
            this.workerManager,
            this.circuitBreaker,
            this.loadMonitor,
            {
                batchSize: this.batchSize,
                dispatchBackoff: this.dispatchBackoff,
                isShutdown: () => this.isShutdown,
                isPaused: () => this.isPaused
            },
            this.queueName
        );
    }

    private async initializeQueue(): Promise<void> {
        try{
            this.workerManager.initialize();
            await this.jobDispatcher.startDispatchLoop();
            
            if(this.enableMetrics){
                this.metricsCollector.startHealthChecking();
            }
            
            this.setupGracefulShutdown();
        }catch(error){
            console.error(`[${this.queueName}] Failed to initialize queue:`, error);
            throw error;
        }
    }

    private async handleWorkerMessage(workerId: number, message: any): Promise<void> {
        const jobInfo = this.workerManager.getJobInfo(workerId);
        if (!jobInfo) return;

        const { job, rawData, startTime } = jobInfo;
        const processingTime = Date.now() - startTime;
        const statusKey = `${this.statusKeyPrefix}${job.jobId}`;
        const twentyFourHoursInSeconds = 24 * 60 * 60;
        const retryCountKey = `job:retries:${job.jobId}`;

        switch(message.status){
            case 'progress':
                await this.jobStatusManager.setJobStatus(job.jobId, 'running', {
                    ...job, 
                    progress: message.progress,
                    processingTimeMs: processingTime,
                });
                this.emit('jobProgress', { job, progress: message.progress });
                return;

            case 'completed':
                await this.jobStatusManager.setJobStatus(job.jobId, 'completed', {
                    ...job,
                    result: message.result,
                    processingTimeMs: processingTime,
                });
                this.redisListenerClient.expire(statusKey, twentyFourHoursInSeconds);
                this.metricsCollector.updateMetrics(processingTime, false);
                this.emit('jobCompleted', { job, result: message.result, processingTime });
                await this.redisListenerClient.del(retryCountKey);
                await this.sessionManager.checkAndCleanupSession(job);
                break;

            case 'failed':
                const shouldCleanupSession = await this.handleJobFailure(job, message.error, processingTime, rawData);
                if (shouldCleanupSession) {
                    this.redisListenerClient.expire(statusKey, twentyFourHoursInSeconds);
                    await this.sessionManager.checkAndCleanupSession(job);
                }
                break;
        }

        if (message.status === 'completed' || message.status === 'failed') {
            this.workerManager.releaseWorker(workerId);
            await this.queueManager.removeJobFromProcessing(rawData);
        }
    }

    private async handleJobFailure(job: T, error: string, processingTime: number, rawData: string): Promise<boolean> {
        // TODO: I think retrying failed processes should be optional. 
        // If it already fails, it will fail again. 
        // I can't think of any reason why retrying after a failure should work.
        const maxAttempts = job.maxRetries || 3;
        const retryCountKey = `job:retries:${job.jobId}`;

        // Increment the retry counter for this job ID in Redis.
        // INCR is atomic, which prevents race conditions.
        const currentAttempt = await this.redisListenerClient.incr(retryCountKey);

        await this.redisListenerClient.expire(retryCountKey, 86400);

        if(currentAttempt < maxAttempts){
            console.log(`[${this.queueName}] Job ${job.jobId} failed. Attempt ${currentAttempt} of ${maxAttempts}. Re-queuing.`);
            const retryJob = {
                ...job,
                retires: currentAttempt
            };

            await this.jobStatusManager.setJobStatus(job.jobId, 'retrying', {
                ...retryJob,
                error,
                processingTimeMs: processingTime
            });

            // We add the original job back to the queue for a new attempt.
            await this.queueManager.addJobStreaming(rawData);
            this.emit('jobRetry', { job: retryJob, error, attemp: currentAttempt });

            return false;
        }

        // If this part of the function is executed it means that the maximum attempt has been reached.
        console.error(`[${this.queueName}] Job ${job.jobId} failed after ${maxAttempts} attempts. Removing from queue permanently.`);
            
        await this.jobStatusManager.setJobStatus(job.jobId, 'failed', { 
            ...job,
            retries: currentAttempt,
            error,
            finalAttempt: true,
            processingTimeMs: processingTime,
        });

        await this.redisListenerClient.del(retryCountKey);

        this.metricsCollector.updateMetrics(processingTime, true);
        this.emit('jobFailed', { job, error, processingTime });

        return true;
    }


    public async addJobs(jobs: T[]): Promise<void> {
        if(jobs.length === 0) return;

        const sessionId = this.sessionManager.generateSessionId();
        const sessionStartTime = new Date().toISOString();

        const jobsWithSession = jobs.map(job => ({
            ...job,
            sessionId,
            sessionStartTime
        }));

        await this.sessionManager.initializeSession(sessionId, sessionStartTime, jobs.length, jobsWithSession[0]);

        if(this.useStreamingAdd){
            await this.addJobsStreaming(jobsWithSession, sessionId, sessionStartTime);
        }else{
            await this.addJobsBatch(jobsWithSession, sessionId, sessionStartTime);
        }
    }

    private async addJobsStreaming(jobs: T[], sessionId: string, sessionStartTime: string): Promise<void> {
        for(const job of jobs){
            await this.queueManager.addJobStreaming(JSON.stringify(job));

            await this.jobStatusManager.setJobStatus(job.jobId, 'queued', {
                ...job,
                sessionId,
                sessionStartTime,
            });

            await this.sleep(50);
        }
    }

    private async addJobsBatch(jobs: T[], sessionId: string, sessionStartTime: string): Promise<void> {
        const priorityJobs: string[] = [];
        const regularJobs: string[] = [];
        
        for(const job of jobs){
            const serialized = JSON.stringify(job);
            
            if(job.priority && job.priority > 5){
                priorityJobs.push(serialized);
            }else{
                regularJobs.push(serialized);
            }
        }
        
        await this.queueManager.addJobsBatch(regularJobs, priorityJobs);

        const statusPromises = jobs.map((job) => 
            this.jobStatusManager.setJobStatus(job.jobId, 'queued', {
                ...job,
                sessionId, 
                sessionStartTime,
            })
        );
        
        await Promise.all(statusPromises);
        this.emit('jobsAdded', { count: jobs.length, priority: priorityJobs.length, regular: regularJobs.length });
    }

    public async getStatus(){
        try{
            const queueLengths = await this.queueManager.getQueueLengths();
            const activeWorkers = this.workerManager.getActiveWorkerCount();
            const totalWorkers = this.workerManager.getTotalWorkerCount();
            const serverLoad = this.loadMonitor.checkServerLoad();

            return {
                queueName: this.queueName,
                maxConcurrent: this.maxConcurrentJobs,
                activeWorkers,
                totalWorkers,
                pendingJobs: queueLengths.pending + queueLengths.priority,
                processingJobs: queueLengths.processing,
                priorityJobs: queueLengths.priority,
                serverLoad,
                metrics: this.metricsCollector.getMetrics(),
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

    public pause(): void {
        this.isPaused = true;
        this.emit('paused');
    }

    public resume(): void {
        this.isPaused = false;
        this.emit('resumed');
    }

    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            await this.shutdown();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    public async shutdown(): Promise<void> {
        this.isShutdown = true;
        this.emit('shutdown');
        
        this.metricsCollector.stopHealthChecking();
        
        const shutdownStart = Date.now();
        while (this.jobMap.size > 0 && (Date.now() - shutdownStart) < this.gracefulShutdownTimeout) {
            await this.sleep(1000);
        }
        
        await this.jobDispatcher.shutdown();
        await this.workerManager.shutdown();
        this.redisListenerClient.disconnect();
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    protected abstract deserializeJob(rawData: string): T;
}