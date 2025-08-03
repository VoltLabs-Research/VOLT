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
import { BaseJob } from '@/types/queues/base-processing-queue';
import { emitJobUpdate } from '@/config/socket';

export class JobStatusManager<T extends BaseJob> {
    constructor(
        private redis: IORedis,
        private statusKeyPrefix: string,
        private jobMap: Map<number, { job: T; rawData: string; startTime: number }>,
        private queueName: string
    ){}

    async setJobStatus(jobId: string, status: string, data: any = {}): Promise<void> {
        const jobInfoFromMap = Array.from(this.jobMap.values()).find((info) => info.job.jobId === jobId);
        let existingJobData = null;
        
        const existingJobStatusString = await this.redis.get(`${this.statusKeyPrefix}${jobId}`);
        if(existingJobStatusString){
            existingJobData = JSON.parse(existingJobStatusString);
        }

        // TODO: ugly
        const statusData = {
            jobId,
            status,
            sessionId: data.sessionId || existingJobData?.sessionId || (jobInfoFromMap?.job as any)?.sessionId,
            sessionStartTime: data.sessionStartTime || existingJobData?.sessionStartTime || (jobInfoFromMap?.job as any)?.sessionStartTime,
            trajectoryId: data.trajectoryId || existingJobData?.trajectoryId || (jobInfoFromMap?.job as any)?.trajectoryId,
            name: data.name || existingJobData?.name || jobInfoFromMap?.job.name,
            message: data.message || existingJobData?.message || jobInfoFromMap?.job.message,
            timestamp: new Date().toISOString(),
            teamId: data.teamId || existingJobData?.teamId || jobInfoFromMap?.job.teamId, 
            chunkIndex: data.chunkIndex !== undefined ? data.chunkIndex : 
                       existingJobData?.chunkIndex !== undefined ? existingJobData.chunkIndex : 
                       (jobInfoFromMap?.job as any)?.chunkIndex,
            totalChunks: data.totalChunks !== undefined ? data.totalChunks : 
                        existingJobData?.totalChunks !== undefined ? existingJobData.totalChunks : 
                        (jobInfoFromMap?.job as any)?.totalChunks,
            ...data
        };

        try{
            const pipeline = this.redis.pipeline();
            
            pipeline.setex(
                `${this.statusKeyPrefix}${jobId}`,
                86400 * 30,
                JSON.stringify(statusData)
            );

            if(statusData.teamId){
                const teamJobsKey = `team:${statusData.teamId}:jobs`;
                pipeline.sadd(teamJobsKey, jobId);
                pipeline.expire(teamJobsKey, 86400 * 30); 
            }

            await pipeline.exec();

            if(statusData.teamId){
                emitJobUpdate(statusData.teamId, statusData);
            }
        }catch(err){
            console.error(`[${this.queueName}] Failed to set job status for ${jobId}:`, err);
        }
    }
}