/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
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

import { BaseProcessingQueue } from '@/queues/base';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { Queues } from '@/constants/queues';
import { Trajectory } from '@/models';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import path from 'path';
import logger from '@/logger';

export class RasterizerQueue extends BaseProcessingQueue<RasterizerJob> {
    constructor() {
        const options: QueueOptions = {
            queueName: Queues.RASTERIZER,
            workerPath: path.resolve(__dirname, '../workers/headless-rasterizer.ts'),
            maxConcurrentJobs: Number(process.env.RASTERIZER_QUEUE_MAX_CONCURRENT_JOBS),
            cpuLoadThreshold: Number(process.env.RASTERIZER_QUEUE_CPU_LOAD_THRESHOLD),
            ramLoadThreshold: Number(process.env.RASTERIZER_QUEUE_RAM_LOAD_THRESHOLD),
            customStatusMapping: {
                running: 'rendering'
            }
        };

        super(options);

        // Listen for job completion to update trajectory updatedAt
        this.on('jobCompleted', (data: any) => {
            this.onJobCompleted(data).catch(error => {
                logger.error(`Unhandled error in rasterizer onJobCompleted handler: ${error}`);
            });
        });
    }

    private async onJobCompleted(data: any): Promise<void> {
        const job = data.job as RasterizerJob;

        try {
            logger.info(`Rasterizer job completed for trajectory ${job.trajectoryId}, updating trajectory updatedAt`);

            // Update trajectory to trigger preview refresh on client
            const trajectory = await Trajectory.findByIdAndUpdate(
                job.trajectoryId,
                { updatedAt: new Date() },
                { new: true }
            );

            if (trajectory) {
                logger.info(`Updated trajectory ${job.trajectoryId} timestamp`);
            }
        } catch (error) {
            logger.error(`Failed to update trajectory ${job.trajectoryId} after rasterizer completion: ${error}`);
        }
    }

    protected deserializeJob(rawData: string): RasterizerJob {
        return JSON.parse(rawData) as RasterizerJob;
    }
}
