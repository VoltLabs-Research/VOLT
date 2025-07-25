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

import { BaseProcessingQueue, BaseJob, QueueOptions } from '@/queues/base-processing-queue';
import path from 'path';
import { redis } from '@/config/redis';

export interface TrajectoryProcessingJob extends BaseJob {
    trajectoryId: string;
    chunkIndex: number;
    totalChunks: number;
    files: {
        frameData: any;
        tempFilePath: string;
    }[];
    folderPath: string;
    gltfFolderPath: string;
    tempFolderPath: string;
}

export class TrajectoryProcessingQueue extends BaseProcessingQueue<TrajectoryProcessingJob> {
    constructor() {
        const options: QueueOptions = {
            queueName: 'trajectory-processing',
            workerPath: path.resolve(__dirname, '../workers/trajectory-processing.ts'),
            maxConcurrentJobs: 2,
            cpuLoadThreshold: 60,
            ramLoadThreshold: 70,
        };
        
        super(options);
    }

    protected deserializeJob(rawData: string): TrajectoryProcessingJob {
        try{
            return JSON.parse(rawData) as TrajectoryProcessingJob;
        }catch(error){
            console.error(`[${this.queueName}] Error deserializing job:`, error);
            throw new Error('Failed to deserialize job data');
        }
    }

    // Override addJobs to handle memory pressure
    public async addJobs(jobs: TrajectoryProcessingJob[]): Promise<void> {
        if(jobs.length === 0) return;

        console.log(`[${this.queueName}] Adding ${jobs.length} jobs to queue`);
        
        // Add jobs one by one to prevent memory spike
        for(const job of jobs){
            try{
                const stringifiedJob = JSON.stringify(job);
                await redis!.lpush(this.queueKey, stringifiedJob);
                await redis!.set(
                    `${this.statusKeyPrefix}${job.jobId}`, 
                    JSON.stringify({ 
                        jobId: job.jobId, 
                        status: 'queued',
                        chunkIndex: job.chunkIndex,
                        totalChunks: job.totalChunks
                    }), 
                    'EX', 
                    86400
                );
                
                console.log(`[${this.queueName}] Added job ${job.jobId} (chunk ${job.chunkIndex + 1}/${job.totalChunks})`);
                
                await new Promise(resolve => setTimeout(resolve, 50));
            }catch(error){
                console.error(`[${this.queueName}] Error adding job ${job.jobId}:`, error);
            }
        }
        
        console.log(`[${this.queueName}] Successfully added all jobs to queue`);
    }
}