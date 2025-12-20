/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import { QueueOptions } from '@/types/queues/base-processing-queue';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import { BaseProcessingQueue } from './base-processing-queue';
import { Trajectory } from '@/models';
import { rasterizeGLBs } from '@/utilities/raster';
import path from 'path';
import { SYS_BUCKETS } from '@/config/minio';
import logger from '@/logger';

export class TrajectoryProcessingQueue extends BaseProcessingQueue<TrajectoryProcessingJob> {
    private firstChunkProcessed = new Set<string>();

    constructor(){
        const options: QueueOptions = {
            queueName: 'trajectory-processing-queue',
            workerPath: path.resolve(__dirname, '../workers/trajectory-processing.ts'),
            maxConcurrentJobs: 5,
            cpuLoadThreshold: 60,
            ramLoadThreshold: 70,
            useStreamingAdd: true
        };

        super(options);

        // Listen for job completion to trigger preview generation
        this.on('jobCompleted', (data: any) => {
            this.onJobCompleted(data).catch(error => {
                logger.error(`Unhandled error in onJobCompleted handler: ${error}`);
            });
        });
    }

    private async onJobCompleted(data: any): Promise<void>{
        const job = data.job as TrajectoryProcessingJob;

        // Only trigger preview generation once per trajectory(first completed chunk wins)
        const trackingKey = `${job.trajectoryId}:preview-scheduled`;
        if(this.firstChunkProcessed.has(trackingKey)) return;

        this.firstChunkProcessed.add(trackingKey);

        try{
            const firstFrame = job.files?.[0];
            if(!firstFrame || firstFrame.frameInfo?.timestep === undefined){
                logger.warn(`No first frame data found for trajectory ${job.trajectoryId}`);
                return;
            }

            const frameGLB = `trajectory-${job.trajectoryId}/previews/timestep-${firstFrame.frameInfo.timestep}.glb`;
            const trajectory = await Trajectory.findById(job.trajectoryId);
            if(!trajectory) throw Error('Trajectory::NotFound');

            await rasterizeGLBs(frameGLB, SYS_BUCKETS.MODELS, SYS_BUCKETS.RASTERIZER, trajectory);

            // If this is part of a session, increment the remaining counter to include this rasterizer job
            if(job.sessionId){
                const counterKey = `session:${job.sessionId}:remaining`;
                await this.redis.incr(counterKey);
                logger.info(`Incremented session counter for rasterizer preview job for trajectory ${job.trajectoryId}`);
            }
        }catch(error){
            logger.error(`Failed to queue preview generation for trajectory ${job.trajectoryId}: ${error}`);
            // Don't throw - trajectory processing shouldn't fail if preview generation fails
        }
    }

    protected deserializeJob(rawData: string): TrajectoryProcessingJob{
        try{
            return JSON.parse(rawData) as TrajectoryProcessingJob;
        }catch(error){
            logger.error(`[${this.queueName}] Error deserializing job: ${error}`);
            throw new Error('Failed to deserialize job data');
        }
    }
}
