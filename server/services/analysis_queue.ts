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
import IORedis from 'ioredis';
import { createRedisClient, redis } from '../config/redis';

interface AnalysisJob{
    trajectoryId: string;
    folderPath: string;
    config: any;
    trajectoryFiles: string[];
}

interface WorkerPoolItem{
    worker: Worker;
    isIdle: boolean;
}

export class AnalysisProcessingQueue {
    private readonly queueKey: string;
    private readonly processingKey: string;
    private readonly statusKeyPrefix: string;
    private readonly statusChannel: string;
    private readonly maxConcurrentJobs: number;

    private workerPool: WorkerPoolItem[] = [];
    private jobMap = new Map<number, { job: AnalysisJob; rawData: string }>();

    private isShutdown = false;
    private redisListenerClient: IORedis;

    constructor(){
        this.queueKey = process.env.ANALYSIS_QUEUE_NAME as string || 'analysis_queue';
        this.processingKey = `${this.queueKey}:processing`;
        this.statusKeyPrefix = `${this.queueKey}:status:`;
        this.statusChannel = 'analysis-status-updates';
        this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_ANALYSES || '2', 10);

        this.redisListenerClient = createRedisClient();

        this.initializeWorkerPool();
        this.startDispatchingJobs();
    }

    private initializeWorkerPool(): void{
        console.log(`Initializing worker pool with ${this.maxConcurrentJobs} workers.`);

        for(let i = 0; i < this.maxConcurrentJobs; i++){
            const worker = this.createWorker();
            this.workerPool.push({ worker, isIdle: true });
        }
    }

    private createWorker(): Worker{
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

    private async startDispatchingJobs(): Promise<void>{
        console.log('Job dispatcher started. Waiting for jobs...');

        while(!this.isShutdown){
            try{
                const rawData = await this.redisListenerClient.blmove(
                    this.queueKey,
                    this.processingKey,
                    'RIGHT',
                    'LEFT',
                    0
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

    private async dispatchJobToWorker(job: AnalysisJob, rawData: string): Promise<void>{
        const availableWorkerItem = this.workerPool.find((item) => item.isIdle);
        if(!availableWorkerItem){
            console.error('No idle worker found, requeueing job.');
            await redis!.lpush(this.queueKey, rawData);
            await redis!.lrem(this.processingKey, 1, rawData);
            return;
        } 
        
        console.log(`[Dispatcher] Assigning job ${job.trajectoryId} to worker #${availableWorkerItem.worker.threadId}`);
        availableWorkerItem.isIdle = false;
        this.jobMap.set(availableWorkerItem.worker.threadId, { job, rawData });
        
        await this.setJobStatus(job.trajectoryId, 'running', { workerId: availableWorkerItem.worker.threadId });
        availableWorkerItem.worker.postMessage({ job });
    }

    private async handleWorkerMessage(workerId: number, message: any): Promise<void>{
        const jobInfo = this.jobMap.get(workerId);
        if(!jobInfo) return;

        const { job, rawData } = jobInfo;

        switch(message.status){
            case 'completed':
                console.log(`Job ${job.trajectoryId} completed by worker #${workerId}.`);
                await this.setJobStatus(job.trajectoryId, 'completed', { result: message.result });
                await redis!.lrem(this.processingKey, 1, rawData);
                this.releaseWorker(workerId);
                break;

            case 'failed':
                console.error(`Job ${job.trajectoryId} failed in worker #${workerId}. Error: ${message.error}`);
                await this.setJobStatus(job.trajectoryId, 'failed', { error: message.error });
                await redis!.lrem(this.processingKey, 1, rawData);
                this.releaseWorker(workerId);
                break;
        }
    }

    private async handleWorkerError(workerId: number, err: Error): Promise<void>{
        console.error(`[Worker #${workerId}] An unrecoverable error occurred:`, err);
        await this.requeueJob(workerId, err.message);
        
        this.replaceWorker(workerId);
    }

    private async handleWorkerExit(workerId: number, code: number): Promise<void>{
        if(code !== 0){
            const errorMessage = `Worker #${workerId} exited unexpectedly with code ${code}.`;
            console.error(errorMessage);
            await this.requeueJob(workerId, errorMessage);
            this.replaceWorker(workerId);
        }
    }

    private releaseWorker(workerId: number): void{
        const workerItem = this.workerPool.find((item) => item.worker.threadId === workerId);
        if(workerItem){
            workerItem.isIdle = true;
        }

        this.jobMap.delete(workerId);
        console.log(`[Worker #${workerId}] is now idle and ready for new jobs.`);
    }

    private async requeueJob(workerId: number, errorMessage: string): Promise<void>{
        const jobInfo = this.jobMap.get(workerId);
        if(jobInfo){
            const { job, rawData } = jobInfo;
            console.log(`Requeuing job ${job.trajectoryId} due to worker failure.`);

            await redis!.multi()
                .lpush(this.queueKey, rawData)
                .lrem(this.processingKey, 1, rawData)
                .exec();

            await this.setJobStatus(job.trajectoryId, 'queued_after_failure', { error: errorMessage });
            this.jobMap.delete(workerId);
        }
    }

    private replaceWorker(workerId: number): void{
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

    private async shutdown(): Promise<void>{
        console.log('Shutting down analysis processing queue...');
        this.isShutdown = true;

        await this.redisListenerClient.quit();
        await Promise.all(this.workerPool.map((item) => item.worker.terminate()));

        console.log('All workers have been terminated.');
    }
    
    public async addJob(job: AnalysisJob): Promise<void>{
        await redis!.lpush(this.queueKey, JSON.stringify(job));
        await this.setJobStatus(job.trajectoryId, 'queued');
    }

    public async getStatus(){
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
            processingJobs: (processing[1] as number) || 0
        }
    }

    public async getJobStatus(trajectoryId: string): Promise<any>{
        const statusData = await redis!.get(`${this.statusKeyPrefix}${trajectoryId}`);
        return statusData ? JSON.parse(statusData) : { status: 'not_found' };
    }

    private async setJobStatus(trajectoryId: string, status: string, data: any = {}): Promise<void>{
        const statusData = { trajectoryId, status, timestamp: new Date().toISOString(), ...data };
        const statusString = JSON.stringify(statusData);
        await redis!.set(`${this.statusKeyPrefix}${trajectoryId}`, statusString, 'EX', 86400);
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