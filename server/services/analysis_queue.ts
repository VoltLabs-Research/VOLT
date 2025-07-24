/**
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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
**/

import { Worker, WorkerOptions } from 'worker_threads';
import path from 'path';
import os from 'os';
import IORedis from 'ioredis';
import { createRedisClient, redis } from '../config/redis';

interface AnalysisJob {
    jobId: string;
    trajectoryId: string;
    folderPath: string;
    config: any;
    inputFile: string;
}

interface WorkerPoolItem {
    worker: Worker;
    isIdle: boolean;
}

export class AnalysisProcessingQueue {
    private readonly queueKey: string;
    private readonly processingKey: string;
    private readonly statusKeyPrefix: string;
    private readonly statusChannel: string;
    private readonly maxConcurrentJobs: number;

    private readonly cpuLoadThreshold: number;
    private readonly ramLoadThreshold: number;
    private readonly checkInterval: number;
    private readonly numCpus: number;

    private workerPool: WorkerPoolItem[] = [];
    private jobMap = new Map<number, { job: AnalysisJob; rawData: string }>();

    private isShutdown = false;
    private redisListenerClient: IORedis;

    constructor() {
        this.queueKey = process.env.ANALYSIS_QUEUE_NAME as string || 'analysis_queue';
        this.processingKey = `${this.queueKey}:processing`;
        this.statusKeyPrefix = `${this.queueKey}:status:`;
        this.statusChannel = 'analysis-status-updates';
        this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_ANALYSES || '2', 10);

        this.cpuLoadThreshold = parseInt(process.env.CPU_LOAD_THRESHOLD || '80', 10);
        this.ramLoadThreshold = parseInt(process.env.RAM_LOAD_THRESHOLD || '85', 10);
        this.checkInterval = parseInt(process.env.LOAD_CHECK_INTERVAL_MS || '1000', 10);
        this.numCpus = os.cpus().length;

        this.redisListenerClient = createRedisClient();

        this.initializeWorkerPool();
        this.startDispatchingJobs();
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
            cpu: parseFloat(cpuUsage.toFixed(2)),
            ram: parseFloat(ramUsage.toFixed(2)),
        };
    }

    private initializeWorkerPool(): void {
        console.log(`Initializing worker pool with a max of ${this.maxConcurrentJobs} workers.`);
        console.log(`Load thresholds set to: CPU > ${this.cpuLoadThreshold}%, RAM > ${this.ramLoadThreshold}%`);

        for(let i = 0; i < this.maxConcurrentJobs; i++){
            const worker = this.createWorker();
            this.workerPool.push({ worker, isIdle: true });
        }
    }

    private createWorker(): Worker {
        const workerPath = path.resolve(__dirname, '../workers/analysis.ts');
        const workerOptions: WorkerOptions = {
            execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
        };

        const worker = new Worker(workerPath, workerOptions);

        worker.on('message', (message) => this.handleWorkerMessage(worker.threadId, message));
        worker.on('error', (err) => this.handleWorkerError(worker.threadId, err));
        worker.on('exit', (code) => this.handleWorkerExit(worker.threadId, code));

        return worker;
    }

    private async startDispatchingJobs(): Promise<void> {
        console.log('Job dispatcher started. Waiting for jobs...');

        while(!this.isShutdown){
            try{
                const serverLoad = this.isServerOverloaded();
                if(serverLoad.overloaded){
                    console.warn(`[Dispatcher] Server load is high (CPU: ${serverLoad.cpu}%, RAM: ${serverLoad.ram}%), pausing job dispatch for ${this.checkInterval}ms.`);
                    await new Promise((resolve) => setTimeout(resolve, this.checkInterval));
                    continue;
                }

                const hasIdleWorker = this.workerPool.some(item => item.isIdle);
                if(!hasIdleWorker){
                    console.log('[Dispatcher] All workers are busy. Pausing before checking for new jobs.');
                    await new Promise(resolve => setTimeout(resolve, this.checkInterval));
                    continue;
                }

                const rawData = await this.redisListenerClient.blmove(
                    this.queueKey,
                    this.processingKey,
                    'RIGHT',
                    'LEFT',
                    1
                );

                if(rawData && !this.isShutdown){
                    const job = JSON.parse(rawData) as AnalysisJob;
                    await this.dispatchJobToWorker(job, rawData);
                }
            }catch(err){
                if(this.isShutdown || (err instanceof Error && err.message.includes('Connection is closed'))){
                    break;
                }
                console.error('[Dispatcher] Error listening for jobs. Retrying in 5 seconds.', err);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
    }

    private async dispatchJobToWorker(job: AnalysisJob, rawData: string): Promise<void> {
        const availableWorkerItem = this.workerPool.find((item) => item.isIdle);

        if(!availableWorkerItem){
            console.error('[Dispatcher] CRITICAL: No idle worker found, despite prior check. Requeueing job.');
            await redis!.lpush(this.queueKey, rawData);
            await redis!.lrem(this.processingKey, 1, rawData);
            return;
        }

        console.log(`[Dispatcher] Assigning job ${job.jobId} to worker #${availableWorkerItem.worker.threadId}`); // Log con jobId
        availableWorkerItem.isIdle = false;
        this.jobMap.set(availableWorkerItem.worker.threadId, { job, rawData });

        await this.setJobStatus(job.jobId, 'running', { workerId: availableWorkerItem.worker.threadId });
        availableWorkerItem.worker.postMessage({ job });
    }

    private async handleWorkerMessage(workerId: number, message: any): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if(!jobInfo) return;

        const { job, rawData } = jobInfo;

        switch(message.status){
            case 'completed':
                console.log(`Job ${job.jobId} completed by worker #${workerId}.`);
                await this.setJobStatus(job.jobId, 'completed', { result: message.result });
                await redis!.lrem(this.processingKey, 1, rawData);
                this.releaseWorker(workerId);
                break;

            case 'failed':
                console.error(`Job ${job.jobId} failed in worker #${workerId}. Error: ${message.error}`);
                await this.setJobStatus(job.jobId, 'failed', { error: message.error });
                await redis!.lrem(this.processingKey, 1, rawData);
                this.releaseWorker(workerId);
                break;
        }
    }

    private async handleWorkerError(workerId: number, err: Error): Promise<void> {
        console.error(`[Worker #${workerId}] An unrecoverable error occurred:`, err);
        await this.requeueJob(workerId, err.message);

        this.replaceWorker(workerId);
    }

    private async handleWorkerExit(workerId: number, code: number): Promise<void> {
        if(code !== 0){
            const errorMessage = `Worker #${workerId} exited unexpectedly with code ${code}.`;
            console.error(errorMessage);
            await this.requeueJob(workerId, errorMessage);
            this.replaceWorker(workerId);
        }
    }

    private releaseWorker(workerId: number): void {
        const workerItem = this.workerPool.find((item) => item.worker.threadId === workerId);
        if(workerItem){
            workerItem.isIdle = true;
        }

        this.jobMap.delete(workerId);
        console.log(`[Worker #${workerId}] is now idle and ready for new jobs.`);
    }

    private async requeueJob(workerId: number, errorMessage: string): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if(jobInfo){
            const { job, rawData } = jobInfo;
            console.log(`Requeuing job ${job.jobId} due to worker failure.`);

            await redis!.multi()
                .lpush(this.queueKey, rawData)
                .lrem(this.processingKey, 1, rawData)
                .exec();

            await this.setJobStatus(job.jobId, 'queued_after_failure', { error: errorMessage });
            this.jobMap.delete(workerId);
        }
    }

    private replaceWorker(workerId: number): void {
        const workerIdx = this.workerPool.findIndex((item) => item.worker.threadId === workerId);

        if(workerIdx !== -1){
            console.log(`Replacing failed worker #${workerId}.`);
            this.workerPool[workerIdx].worker.terminate();

            const newWorker = this.createWorker();
            this.workerPool[workerIdx] = {
                worker: newWorker,
                isIdle: true
            };

            console.log(`New worker #${newWorker.threadId} created and added to the pool.`);
        }
    }

    public async addJobs(jobs: AnalysisJob[]): Promise<void> {
        if (jobs.length === 0) return;

        const stringifiedJobs = jobs.map(job => JSON.stringify(job));
        await redis!.lpush(this.queueKey, ...stringifiedJobs);

        const multi = redis!.multi();
        for (const job of jobs) {
            const statusData = { jobId: job.jobId, trajectoryId: job.trajectoryId, status: 'queued', timestamp: new Date().toISOString() };
            multi.set(`${this.statusKeyPrefix}${job.jobId}`, JSON.stringify(statusData), 'EX', 86400);
        }
        await multi.exec();
    }

    private async shutdown(): Promise<void> {
        console.log('Shutting down analysis processing queue...');
        this.isShutdown = true;

        await this.redisListenerClient.quit();
        await Promise.all(this.workerPool.map((item) => item.worker.terminate()));

        console.log('All workers have been terminated.');
    }

    public async addJob(job: AnalysisJob): Promise<void> {
        await redis!.lpush(this.queueKey, JSON.stringify(job));
        await this.setJobStatus(job.jobId, 'queued');
    }

    public async getStatus(){
        // @ts-ignore
        const [pending, processing] = await redis!
            .multi()
            .llen(this.queueKey)
            .llen(this.processingKey)
            .exec();

        const activeWorkers = this.workerPool.filter((item) => !item.isIdle).length;
        return {
            maxConcurrent: this.maxConcurrentJobs,
            activeWorkers: activeWorkers,
            pendingJobs: (pending[1] as number) || 0,
            processingJobs: (processing[1] as number) || 0,
            serverLoad: this.isServerOverloaded()
        }
    }

    public async getJobStatus(jobId: string): Promise<any> {
        const statusData = await redis!.get(`${this.statusKeyPrefix}${jobId}`);
        return statusData ? JSON.parse(statusData) : { status: 'not_found' };
    }

    private async setJobStatus(jobId: string, status: string, data: any = {}): Promise<void> {
        const statusData = { jobId, status, timestamp: new Date().toISOString(), ...data };
        const statusString = JSON.stringify(statusData);
        await redis!.set(`${this.statusKeyPrefix}${jobId}`, statusString, 'EX', 86400);
        await redis!.publish(this.statusChannel, statusString);
    }
}

let analysisProcessingQueue: AnalysisProcessingQueue | null = null;

export const getAnalysisProcessingQueue = (): AnalysisProcessingQueue => {
    if(!analysisProcessingQueue){
        analysisProcessingQueue = new AnalysisProcessingQueue();
    }

    return analysisProcessingQueue;
};