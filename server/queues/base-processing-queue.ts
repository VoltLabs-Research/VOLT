import { Worker } from 'worker_threads';
import os from 'os';
import IORedis from 'ioredis';
import { createRedisClient, redis } from '@config/redis';

export interface BaseJob{
    jobId: string;
}

interface WorkerPoolItem{
    worker: Worker;
    isIdle: boolean;
}

export interface QueueOptions{
    queueName: string;
    workerPath: string;
    maxConcurrentJobs?: number;
    cpuLoadThreshold?: number;
    ramLoadThreshold?: number;
}

export abstract class BaseProcessingQueue<T extends BaseJob>{
    protected readonly queueName: string;
    protected readonly workerPath: string;
    protected readonly queueKey: string;
    protected readonly processingKey: string;
    protected readonly statusKeyPrefix: string;
    protected readonly maxConcurrentJobs: number;
    protected readonly cpuLoadThreshold: number;
    protected readonly ramLoadThreshold: number;
    protected readonly checkInterval: number;
    protected readonly numCpus: number;
    
    protected workerPool: WorkerPoolItem[] = [];
    protected jobMap = new Map<number, { job: T; rawData: string }>();
    protected isShutdown = false;
    protected redisListenerClient: IORedis;

    constructor(options: QueueOptions){
        this.queueName = options.queueName;
        this.workerPath = options.workerPath;
        this.queueKey = `${this.queueName}_queue`;
        this.processingKey = `${this.queueKey}:processing`;
        this.statusKeyPrefix = `${this.queueKey}:status:`;
        this.maxConcurrentJobs = options.maxConcurrentJobs || os.cpus().length;
        this.cpuLoadThreshold = options.cpuLoadThreshold || 80;
        this.ramLoadThreshold = options.ramLoadThreshold || 85;
        this.checkInterval = 1000;
        this.numCpus = os.cpus().length;
        this.redisListenerClient = createRedisClient();

        this.initializeWorkerPool();
        this.startDispatchingJobs();
    }

    private async startDispatchingJobs(): Promise<void> {
        console.log(`[${this.queueName}] Dispatcher started. Waiting for jobs...`);
        while(!this.isShutdown){
            try{
                if(this.isServerOverloaded().overloaded){
                    console.warn(`[${this.queueName}] Server load high, pausing dispatch.`);
                    await new Promise((resolve) => setTimeout(resolve, this.checkInterval));
                    continue;
                }

                if(!this.workerPool.some((item) => item.isIdle)){
                    await new Promise((resolve) => setTimeout(resolve, this.checkInterval));
                    continue;
                }

                const rawData = await this.redisListenerClient.blmove(this.queueKey, this.processingKey, 'RIGHT', 'LEFT', 1);
                if(rawData && !this.isShutdown){
                    const job = this.deserializeJob(rawData);
                    await this.dispatchJobToWorker(job, rawData);
                }
            }catch(err){
                if(this.isShutdown || (err instanceof Error && err.message.includes('Connection is closed'))){
                    break;
                }

                console.error(`[${this.queueName}] Dispatcher error. Retrying.`, err);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
    }

    private async dispatchJobToWorker(job: T, rawData: string): Promise<void>{
        const availableWorkerItem = this.workerPool.find((item) => item.isIdle);
        if(!availableWorkerItem){
            await redis!.lpush(this.queueKey, rawData);
            await redis!.lrem(this.processingKey, 1, rawData);
            return;
        }

        availableWorkerItem.isIdle = false;
        this.jobMap.set(availableWorkerItem.worker.threadId, { job, rawData });
        await this.setJobStatus(job.jobId, 'running', { workerId: availableWorkerItem.worker.threadId });
        availableWorkerItem.worker.postMessage({ job });
    }

    private async handleWorkerMessage(workerId: number, message: any): Promise<void>{
        const jobInfo = this.jobMap.get(workerId);
        if(!jobInfo) return;

        const { job, rawData } = jobInfo;
        switch(message.status){
            case 'completed':
                await this.setJobStatus(job.jobId, 'completed', { result: message.result });
                break;

            case 'failed':
                await this.setJobStatus(job.jobId, 'failed', { error: message.error });
                break;
        }

        await redis!.lrem(this.processingKey, 1, rawData);
        this.releaseWorker(workerId);
    }

    private releaseWorker(workerId: number): void{
        const workerItem = this.workerPool.find((item) => item.worker.threadId === workerId);
        if(workerItem) workerItem.isIdle = true;
        this.jobMap.delete(workerId);
    }

    private async handleWorkerError(workerId: number, err: Error): Promise<void>{
        await this.requeueJob(workerId, err.message);
        this.replaceWorker(workerId);
    }

    private async handleWorkerExit(workerId: number, code: number): Promise<void>{
        if(code !== 0){
            const errorMessage = `[${this.queueName}] Worker #${workerId} exited unexpectedly with code ${code}.`;
            await this.requeueJob(workerId, errorMessage);
            this.replaceWorker(workerId);
        }
    }

    private async requeueJob(workerId: number, errorMessage: string): Promise<void>{
        const jobInfo = this.jobMap.get(workerId);
        if(jobInfo){
            const { job, rawData } = jobInfo;
            await redis!.multi().lpush(this.queueKey, rawData).lrem(this.processingKey, 1, rawData).exec();
            await this.setJobStatus(job.jobId, 'queued_after_failure', { error: errorMessage });
            this.jobMap.delete(workerId);
        }
    }

    private replaceWorker(workerId: number): void{
        const workerIndex = this.workerPool.findIndex((item) => item.worker.threadId === workerId);
        
        if(workerIndex !== -1){
            this.workerPool[workerIndex].worker.terminate();
            this.workerPool[workerIndex] = { worker: this.createWorker(), isIdle: true };
        }
    }

    public async addJobs(jobs: T[]): Promise<void>{
        if(jobs.length === 0) return;

        const stringifiedJobs = jobs.map((job) => JSON.stringify(job));
        await redis!.lpush(this.queueKey, ...stringifiedJobs);
        const multi = redis!.multi();
        for(const job of jobs){
            multi.set(`${this.statusKeyPrefix}${job.jobId}`, JSON.stringify({ jobId: job.jobId, status: 'queued' }), 'EX', 86400);
        }
        await multi.exec();
    }

    private async setJobStatus(jobId: string, status: string, data: any = {}): Promise<void>{
        const statusData = { jobId, status, timestamp: new Date().toISOString(), ...data };
        await redis!.set(`${this.statusKeyPrefix}${jobId}`, JSON.stringify(statusData), 'EX', 86400);
    }

    protected abstract deserializeJob(rawData: string): T;

    private initializeWorkerPool(): void{
        console.log(`[${this.queueName}] Initializing worker pool with ${this.maxConcurrentJobs} workers.`);

        for(let i = 0; i < this.maxConcurrentJobs; i++){
            this.workerPool.push({ worker: this.createWorker(), isIdle: true });
        }
    }


private createWorker(): Worker {
    console.log(`[${this.queueName}] Creating worker with path: ${this.workerPath}`);
    const worker = new Worker(this.workerPath, {
        execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
    });

    // AÑADE ESTOS LOGS
    worker.on('online', () => {
        console.log(`[${this.queueName}] Worker #${worker.threadId} is online.`);
    });
    
    worker.on('message', (message) => this.handleWorkerMessage(worker.threadId, message));
    worker.on('error', (err) => {
        // Loguea el error completo
        console.error(`[${this.queueName}] Worker #${worker.threadId} encountered an error:`, err);
        this.handleWorkerError(worker.threadId, err)
    });
    worker.on('exit', (code) => {
        // Loguea la salida
        console.log(`[${this.queueName}] Worker #${worker.threadId} exited with code ${code}.`);
        this.handleWorkerExit(worker.threadId, code);
    });
    return worker;
}


    public async getStatus(){
        // TODO:
        // @ts-ignore
        const [pendingResult, processingResult] = await redis!
            .multi()
            .llen(this.queueKey)
            .llen(this.processingKey)
            .exec();

        const pendingJobs = (pendingResult?.[1] as number) || 0;
        const processingJobs = (processingResult?.[1] as number) || 0;
        const activeWorkers = this.workerPool.filter(item => !item.isIdle).length;
        const serverLoad = this.isServerOverloaded();

        return {
            queueName: this.queueName,
            maxConcurrent: this.maxConcurrentJobs,
            activeWorkers: activeWorkers,
            pendingJobs: pendingJobs,
            processingJobs: processingJobs,
            serverLoad: serverLoad
        };
    }

    private isServerOverloaded(): { overloaded: boolean, cpu: number, ram: number }{
        const loadAvg = os.loadavg()[0];
        const cpuUsage = (loadAvg / this.numCpus) * 100;
        
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const ramUsage = (usedMem / totalMem) * 100;
        
        const overloaded = cpuUsage > this.cpuLoadThreshold || ramUsage > this.ramLoadThreshold;

        return { 
            overloaded, 
            cpu: parseFloat(cpuUsage.toFixed(2)), 
            ram: parseFloat(ramUsage.toFixed(2))
        };
    }
}