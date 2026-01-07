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

import { BaseProcessingQueue } from '@/queues/base';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import path from 'path';
import { Queues } from '@/constants/queues';
import { createRedisClient } from '@config/redis';
import IORedis from 'ioredis';

export class AnalysisProcessingQueue extends BaseProcessingQueue<AnalysisJob> {
    protected deserializeJob(rawData: string): AnalysisJob {
        return JSON.parse(rawData) as AnalysisJob;
    }

    private subscriber: IORedis | null = null;

    constructor() {
        const options: QueueOptions = {
            queueName: Queues.ANALYSIS_PROCESSING,
            workerPath: path.resolve(__dirname, '../workers/analysis.ts'),
            maxConcurrentJobs: Number(process.env.ANALYSIS_QUEUE_MAX_CONCURRENT_JOBS),
            cpuLoadThreshold: Number(process.env.ANALYSIS_QUEUE_CPU_LOAD_THRESHOLD),
            ramLoadThreshold: Number(process.env.ANALYSIS_QUEUE_RAM_LOAD_THRESHOLD),
        };

        super(options);
        this.initializeSubscriber();
    }

    private async initializeSubscriber() {
        this.subscriber = createRedisClient();
        await this.subscriber.subscribe('cloud_upload_completion');

        this.subscriber.on('message', async (channel, message) => {
            if (channel === 'cloud_upload_completion') {
                try {
                    const { trajectoryId, timestep } = JSON.parse(message);
                    await this.processPendingUploads(trajectoryId, Number(timestep));
                } catch (e) {
                    // ignore
                }
            }
        });

        this.initializeWatchdog();
    }

    private initializeWatchdog() {
        // Run every 30 seconds
        setInterval(async () => {
            try {
                await this.processWatchdog();
            } catch (e) { /* ignore */ }
        }, 30000);
    }

    /**
     * Process jobs that were waiting for an upload to complete
     */
    private async processPendingUploads(trajectoryId: string, timestep: number): Promise<void> {
        const waitListKey = `waiting:upload:${trajectoryId}:${timestep}`;

        // Move all waiting jobs back to the main queue
        const lua = `
            local waiting = redis.call('LRANGE', KEYS[1], 0, -1)
            if #waiting > 0 then
                for i, job in ipairs(waiting) do
                    redis.call('LPUSH', KEYS[2], job)
                end
                redis.call('DEL', KEYS[1])
            end
            return #waiting
        `;

        await this.redis.eval(lua, 2, waitListKey, this.queueKey);
    }

    private async processWatchdog() {
    }

    protected async handleWorkerMessage(workerId: number, message: any): Promise<void> {
        if (message.status === 'waiting_for_upload') {
            const jobInfo = this.jobMap.get(workerId);
            if (jobInfo) {
                const { rawData, job } = jobInfo;
                const timestep = message.timestep;

                const flagKey = `upload:done:${job.trajectoryId}:${timestep}`;
                const waitListKey = `waiting:upload:${job.trajectoryId}:${timestep}`;

                const lua = `
                    if redis.call('EXISTS', KEYS[1]) == 1 then
                        return 1
                    else
                        redis.call('RPUSH', KEYS[2], ARGV[1])
                        return 0
                    end
                `;

                const result = await this.redis.eval(lua, 2, flagKey, waitListKey, rawData);

                if (result === 1) {
                    await this.redis.multi()
                        .lpush(this.queueKey, rawData)
                        .lrem(this.processingKey, 1, rawData)
                        .exec();

                    await this.finishJob(workerId, rawData);
                    return;
                }

                // Parked successfully by Lua. Just remove from processing.
                await this.redis.lrem(this.processingKey, 1, rawData);
                await this.finishJob(workerId, rawData);
                return;
            }
        }
        return super.handleWorkerMessage(workerId, message);
    }
}
