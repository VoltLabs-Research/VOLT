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

import IORedis from 'ioredis';

export interface QueueKeys {
    queueKey: string;
    processingKey: string;
    priorityQueueKey: string;
}

export class QueueManager{
    constructor(
        private redis: IORedis,
        private keys: QueueKeys
    ){}

    async fetchJobs(count: number): Promise<string[]> {
        const jobs: string[] = [];
        
        const priorityJobs = await this.getJobsFromQueue(this.keys.priorityQueueKey, Math.min(count, 5));
        jobs.push(...priorityJobs);
        
        if(jobs.length < count){
            const regularJobs = await this.getJobsFromQueue(this.keys.queueKey, count - jobs.length);
            jobs.push(...regularJobs);
        }
        
        return jobs;
    }

    async addJobsBatch(regularJobs: string[], priorityJobs: string[]): Promise<void> {
        const pipeline = this.redis.pipeline();
        
        if(priorityJobs.length > 0){
            pipeline.lpush(this.keys.priorityQueueKey, ...priorityJobs);
        }

        if(regularJobs.length > 0){
            pipeline.lpush(this.keys.queueKey, ...regularJobs);
        }
        
        await pipeline.exec();
    }

    async addJobStreaming(jobData: string): Promise<void> {
        await this.redis.lpush(this.keys.queueKey, jobData);
    }

    async returnJobToQueue(rawData: string): Promise<void> {
        await this.redis.multi()
            .lpush(this.keys.queueKey, rawData)
            .lrem(this.keys.processingKey, 1, rawData)
            .exec();
    }

    async handleFailedJobDispatch(rawData: string): Promise<void> {
        try{
            await this.redis.multi()
                .lpush(this.keys.queueKey, rawData)
                .lrem(this.keys.processingKey, 1, rawData)
                .exec();
        }catch(moveError){
            console.error(`Critical: Failed to return job to queue:`, moveError);
        }
    }

    async requeueJob(rawData: string): Promise<void> {
        await this.redis.multi()
            .lpush(this.keys.queueKey, rawData)
            .lrem(this.keys.processingKey, 1, rawData)
            .exec();
    }

    async removeJobFromProcessing(rawData: string): Promise<void> {
        await this.redis.lrem(this.keys.processingKey, 1, rawData);
    }

    async getQueueLengths(): Promise<{ pending: number; processing: number; priority: number }> {
        const results = await this.redis.multi()
            .llen(this.keys.queueKey)
            .llen(this.keys.processingKey)
            .llen(this.keys.priorityQueueKey)
            .exec();

        return {
            pending: (results?.[0]?.[1] as number) || 0,
            processing: (results?.[1]?.[1] as number) || 0,
            priority: (results?.[2]?.[1] as number) || 0
        };
    }

    private async getJobsFromQueue(queueKey: string, count: number): Promise<string[]> {
        if(count <= 0) return [];
        
        const jobs: string[] = [];
        const pipeline = this.redis.pipeline();
        
        for(let i = 0; i < count; i++){
            pipeline.blmove(queueKey, this.keys.processingKey, 'RIGHT', 'LEFT', 0.1);
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
            console.error(`Redis pipeline error:`, error);
        }
        
        return jobs;
    }
}