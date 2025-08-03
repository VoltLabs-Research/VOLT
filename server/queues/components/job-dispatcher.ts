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

import { BaseJob, CircuitBreaker } from '@/types/queues/base-processing-queue';
import { QueueManager } from '@/queues/components/queue-manager';
import { WorkerPoolManager } from '@/queues/components/worker-pool-manager';
import { LoadMonitor } from '@/queues/components/load-monitor';

interface DispatchBackoff {
    initial: number;
    max: number;
    current: number;
    multiplier: number;
}

interface DispatchOptions {
    batchSize: number;
    dispatchBackoff: DispatchBackoff;
    isShutdown: () => boolean;
    isPaused: () => boolean;
}

export class JobDispatcher<T extends BaseJob>{
    private dispatcherPromise?: Promise<void>;

    constructor(
        private queueManager: QueueManager,
        private workerManager: WorkerPoolManager<T>,
        private circuitBreaker: CircuitBreaker,
        private loadMonitor: LoadMonitor,
        private options: DispatchOptions,
        private queueName: string
    ){}

    async startDispatchLoop(): Promise<void> {
        this.dispatcherPromise = this.dispatchLoop();
        return this.dispatcherPromise;
    }

    async shutdown(): Promise<void> {
        if(this.dispatcherPromise){
            await this.dispatcherPromise;
        }
    }

    private async dispatchLoop(): Promise<void> {
        console.log(`[${this.queueName}] Dispatcher started.`);
        
        while(!this.options.isShutdown()){
            try{
                if(this.options.isPaused()){
                    await this.sleep(1000);
                    continue;
                }

                if(this.circuitBreaker.isOpen()){
                    await this.sleep(this.circuitBreaker.timeout / 10);
                    continue;
                }

                const loadCheck = this.loadMonitor.checkServerLoad();
                if(loadCheck.overloaded){
                    await this.handleBackpressure();
                    continue;
                }

                await this.processAvailableJobs();
                await this.sleep(25);

            }catch(err){
                await this.handleDispatchError(err);
            }
        }
        
        console.log(`[${this.queueName}] Dispatcher stopped.`);
    }

    private async processAvailableJobs(): Promise<void> {
        const availableWorkers = this.workerManager.getAvailableWorkerCount();
        if(availableWorkers === 0){
            await this.sleep(100);
            return;
        }

        const jobsToProcess = Math.min(availableWorkers, this.options.batchSize);
        const jobs = await this.queueManager.fetchJobs(jobsToProcess);

        if(jobs.length === 0){
            await this.handleNoJobs();
            return;
        }

        this.resetBackpressure();
        await this.dispatchJobs(jobs);
    }

    private async dispatchJobs(jobs: string[]): Promise<void> {
        const promises = jobs.map((rawData) => {
            try{
                return this.workerManager.dispatchJob(rawData);
            }catch(error){
                return this.queueManager.handleFailedJobDispatch(rawData);
            }
        });

        await Promise.allSettled(promises);
    }

    private async handleBackpressure(): Promise<void> {
        await this.sleep(this.options.dispatchBackoff.current);
        this.options.dispatchBackoff.current = Math.min(
            this.options.dispatchBackoff.current * this.options.dispatchBackoff.multiplier, 
            this.options.dispatchBackoff.max
        );
    }

    private async handleNoJobs(): Promise<void> {
        this.options.dispatchBackoff.current = Math.min(
            this.options.dispatchBackoff.current * 1.2, 
            this.options.dispatchBackoff.max
        );
        await this.sleep(this.options.dispatchBackoff.current);
    }

    private resetBackpressure(): void {
        this.options.dispatchBackoff.current = this.options.dispatchBackoff.initial;
        this.circuitBreaker.reset();
    }

    private async handleDispatchError(err: any): Promise<void> {
        if(this.options.isShutdown() || (err instanceof Error && err.message.includes('Connection is closed'))){
            return;
        }

        this.circuitBreaker.recordFailure();
        console.error(`[${this.queueName}] Dispatcher error:`, err);
        await this.sleep(Math.min(this.circuitBreaker.failures * 1000, 10000));
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}