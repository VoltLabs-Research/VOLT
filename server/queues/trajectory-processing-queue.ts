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
import { BaseProcessingQueue } from '@/queues/base';
import { Trajectory } from '@/models';
import { rasterizeGLBs } from '@/utilities/raster';
import { SYS_BUCKETS } from '@/config/minio';
import { Queues } from '@/constants/queues';
import path from 'path';
import logger from '@/logger';

export class TrajectoryProcessingQueue extends BaseProcessingQueue<TrajectoryProcessingJob> {
    private firstChunkProcessed = new Set<string>();

    constructor() {
        const options: QueueOptions = {
            queueName: Queues.TRAJECTORY_PROCESSING,
            workerPath: path.resolve(__dirname, '../workers/trajectory-processing.ts'),
            maxConcurrentJobs: Number(process.env.TRAJECTORY_QUEUE_MAX_CONCURRENT_JOBS),
            cpuLoadThreshold: Number(process.env.TRAJECTORY_QUEUE_CPU_LOAD_THRESHOLD),
            ramLoadThreshold: Number(process.env.TRAJECTORY_QUEUE_RAM_LOAD_THREHOLD),
            customStatusMapping: {
                running: 'processing'
            }
        };

        super(options);
    }

    /**
     * Override to add preview generation jobs before trajectory job counter decrements.
     * This ensures the rasterizer job is counted before this job's count decreases,
     * preventing premature trajectory completion.
     */
    protected async onBeforeDecrement(job: TrajectoryProcessingJob): Promise<number> {
        // Only trigger preview generation once per trajectory
        const trackingKey = `${job.trajectoryId}:preview-scheduled`;
        if (this.firstChunkProcessed.has(trackingKey)) return 0;
        this.firstChunkProcessed.add(trackingKey);

        try {
            const frameInfo = job.file?.frameInfo;
            if (!frameInfo || frameInfo.timestep === undefined) {
                logger.warn(`No frame data found for trajectory ${job.trajectoryId}`);
                return 0;
            }

            const frameGLB = `trajectory-${job.trajectoryId}/previews/timestep-${frameInfo.timestep}.glb`;
            const trajectory = await Trajectory.findById(job.trajectoryId);
            if (!trajectory) throw Error('Trajectory::NotFound');

            // Queue rasterizer jobs (addJobs increments the trajectory job counter)
            await rasterizeGLBs(frameGLB, SYS_BUCKETS.MODELS, SYS_BUCKETS.RASTERIZER, trajectory);
            return 1; // At least 1 rasterizer job was added
        } catch (error) {
            logger.error(`Failed to queue preview generation for trajectory ${job.trajectoryId}: ${error}`);
            return 0;
        }
    }

    protected deserializeJob(rawData: string): TrajectoryProcessingJob {
        try {
            return JSON.parse(rawData) as TrajectoryProcessingJob;
        } catch (error) {
            logger.error(`[${this.queueName}] Error deserializing job: ${error}`);
            throw new Error('Failed to deserialize job data');
        }
    }
}
