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

import { EventEmitter } from 'events';
import { QueueMetrics } from '@/types/queues/base-processing-queue';

export class MetricsCollector extends EventEmitter {
    private metrics: QueueMetrics;
    private healthCheckInterval_: NodeJS.Timeout | null = null;

    constructor(
        private enableMetrics: boolean,
        private healthCheckInterval: number = 30000,
        private jobTimeout: number = 1.8e+6,
        private queueName: string = '',
        private jobMap: Map<number, { job: any; rawData: string; startTime: number }> = new Map()
    ){
        super();
        
        this.metrics = {
            totalJobsProcessed: 0,
            totalJobsFailed: 0,
            averageProcessingTimeMs: 0,
            peakMemoryUsageMB: 0,
            workerRestarts: 0,
            lastHealthCheck: new Date().toISOString()
        };
    }

    startHealthChecking(): void {
        if(!this.enableMetrics) return;
        
        this.healthCheckInterval_ = setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckInterval);
    }

    stopHealthChecking(): void {
        if(this.healthCheckInterval_){
            clearInterval(this.healthCheckInterval_);
            this.healthCheckInterval_ = null;
        }
    }

    updateMetrics(processingTime: number, failed: boolean): void {
        if(!this.enableMetrics) return;
        
        if(failed){
            this.metrics.totalJobsFailed++;
        }else{
            this.metrics.totalJobsProcessed++;
        }
        
        const totalJobs = this.metrics.totalJobsProcessed + this.metrics.totalJobsFailed;
        this.metrics.averageProcessingTimeMs = 
            (this.metrics.averageProcessingTimeMs * (totalJobs - 1) + processingTime) / totalJobs;
    }

    incrementWorkerRestarts(): void {
        if(this.enableMetrics){
            this.metrics.workerRestarts++;
        }
    }

    getMetrics(): QueueMetrics | null {
        return this.enableMetrics ? this.metrics : null;
    }

    private performHealthCheck(): void {
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
}