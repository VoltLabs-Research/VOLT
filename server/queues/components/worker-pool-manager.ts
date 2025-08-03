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

import { Worker } from 'worker_threads';
import { BaseJob, WorkerPoolItem } from '@/types/queues/base-processing-queue';

export class WorkerPoolManager<T extends BaseJob> {
    private workerPool: WorkerPoolItem[] = [];
    private jobMap = new Map<number, { job: T; rawData: string; startTime: number }>();
    private isShutdown = false;

    constructor(
        private workerPath: string,
        private maxConcurrentJobs: number,
        private jobTimeout: number,
        private workerIdleTimeout: number,
        private deserializeJob: (rawData: string) => T,
        private onJobComplete: (workerId: number, message: any) => Promise<void>,
        private onWorkerRestart: () => void,
        private queueName: string,
        private setJobStatus: (jobId: string, status: string, data: any) => Promise<void>
    ){}

    initialize(): void {
        for(let i = 0; i < this.maxConcurrentJobs; i++){
            this.workerPool.push(this.createWorkerItem());
        }
        this.startWorkerCleanup();
    }

    async dispatchJob(rawData: string): Promise<void> {
        const workerItem = this.getBestAvailableWorker();
        if(!workerItem){
            return;
        }

        try{
            const job = this.deserializeJob(rawData);
            await this.assignJobToWorker(workerItem, job, rawData);
        }catch(error){
            console.error(`[${this.queueName}] Failed to dispatch job:`, error);
            throw error;
        }
    }

    getAvailableWorkerCount(): number {
        return this.workerPool.filter(item => item.isIdle).length;
    }

    getTotalWorkerCount(): number {
        return this.workerPool.length;
    }

    getActiveWorkerCount(): number {
        return this.workerPool.filter(item => !item.isIdle).length;
    }

    getJobInfo(workerId: number): { job: T; rawData: string; startTime: number } | undefined {
        return this.jobMap.get(workerId);
    }

    releaseWorker(workerId: number): void {
        const workerItem = this.workerPool.find(item => item.worker.threadId === workerId);
        if (workerItem) {
            this.clearWorkerTimeouts(workerItem);
            workerItem.isIdle = true;
            workerItem.currentJobId = undefined;
            workerItem.startTime = undefined;
            workerItem.lastUsed = Date.now();
            workerItem.jobCount++;
        }
        this.jobMap.delete(workerId);
    }

    async handleWorkerError(workerId: number, err: Error): Promise<void> {
        console.error(`[${this.queueName}] Worker #${workerId} error:`, err);
        await this.requeueJob(workerId, err.message);
        this.replaceWorker(workerId);
    }

    handleWorkerExit(workerId: number, code: number): void {
        if(code !== 0){
            console.error(`[${this.queueName}] Worker #${workerId} exited unexpectedly with code ${code}`);
            this.requeueJob(workerId, `Worker exited with code ${code}`);
        }
        this.replaceWorker(workerId);
    }

    async shutdown(): Promise<void> {
        this.isShutdown = true;
        
        const terminatePromises = this.workerPool.map(item => {
            this.clearWorkerTimeouts(item);
            return item.worker.terminate();
        });
        
        await Promise.allSettled(terminatePromises);
        this.workerPool = [];
        this.jobMap.clear();
    }

    private async assignJobToWorker(workerItem: WorkerPoolItem, job: T, rawData: string): Promise<void> {
        const startTime = Date.now();
        workerItem.isIdle = false;
        workerItem.currentJobId = job.jobId;
        workerItem.startTime = startTime;
        workerItem.lastUsed = startTime;
        
        this.jobMap.set(workerItem.worker.threadId, { job, rawData, startTime });
        
        const timeout = setTimeout(() => {
            this.handleJobTimeout(workerItem.worker.threadId, job.jobId);
        }, this.jobTimeout);
        
        workerItem.timeouts.add(timeout);
        
        try{
            await this.setJobStatus(job.jobId, 'running', { 
                workerId: workerItem.worker.threadId,
                startTime: new Date(startTime).toISOString(),
                teamId: job.teamId,
                trajectoryId: (job as any).trajectoryId
            });
            
            workerItem.worker.postMessage({ job });
        }catch(error){
            this.clearWorkerTimeouts(workerItem);
            workerItem.isIdle = true;
            this.jobMap.delete(workerItem.worker.threadId);
            throw error;
        }
    }

    private getBestAvailableWorker(): WorkerPoolItem | undefined {
        const idleWorkers = this.workerPool.filter(item => item.isIdle);
        if(idleWorkers.length === 0) return undefined;
        
        return idleWorkers.reduce((best, current) => {
            if (current.jobCount < best.jobCount) return current;
            if (current.jobCount === best.jobCount && current.lastUsed < best.lastUsed) return current;
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

    private async requeueJob(workerId: number, errorMessage: string): Promise<void> {
        const jobInfo = this.jobMap.get(workerId);
        if(jobInfo){
            const { job } = jobInfo;
            try{
                await this.setJobStatus(job.jobId, 'queued_after_failure', { 
                    error: errorMessage, 
                    teamId: job.teamId, 
                    trajectoryId: (job as any).trajectoryId 
                });
                console.log(`[${this.queueName}] Requeued job ${job.jobId} due to worker failure`);
            }catch(error){
                console.error(`[${this.queueName}] Failed to update job status for requeue:`, error);
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
            this.onWorkerRestart();
            
            console.log(`[${this.queueName}] Replaced worker #${workerId} with new worker #${this.workerPool[workerIndex].worker.threadId}`);
        }
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

        worker.on('message', (message) => this.onJobComplete(worker.threadId, message));
        worker.on('error', (err) => this.handleWorkerError(worker.threadId, err));
        worker.on('exit', (code) => this.handleWorkerExit(worker.threadId, code));
        
        return worker;
    }

    private clearWorkerTimeouts(workerItem: WorkerPoolItem): void {
        workerItem.timeouts.forEach(timeout => clearTimeout(timeout));
        workerItem.timeouts.clear();
    }

    private startWorkerCleanup(): void {
        setInterval(() => {
            if(this.isShutdown || this.workerPool.length <= 1) return;
            
            const now = Date.now();
            const workersToRemove = this.workerPool
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.isIdle && (now - item.lastUsed) > this.workerIdleTimeout)
                .map(({ index }) => index)
                .sort((a, b) => b - a);
            
            if(workersToRemove.length > 0 && this.workerPool.length - workersToRemove.length >= 1){
                workersToRemove.forEach(index => {
                    const item = this.workerPool[index];
                    this.clearWorkerTimeouts(item);
                    item.worker.terminate();
                    this.workerPool.splice(index, 1);
                });
            }
        }, this.workerIdleTimeout / 3);
    }
}