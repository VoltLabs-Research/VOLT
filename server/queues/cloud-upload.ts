import { BaseProcessingQueue } from '@/queues/base-processing-queue';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { Queues } from '@/constants/queues';
import { CloudUploadJob } from '@/types/services/cloud-upload';
import * as path from 'node:path';

export class CloudUploadQueue extends BaseProcessingQueue<CloudUploadJob> {
    constructor() {
        const options: QueueOptions = {
            queueName: Queues.CLOUD_UPLOAD,
            workerPath: path.resolve(__dirname, '../workers/cloud-upload.ts')
        };

        super(options);

        this.on('jobCompleted', async ({ job }) => {
            try {
                if (this.redis) {
                    await this.handleUploadCompletion(job);
                }
            } catch (err) {
                // Non-critical, just logging
            }
        });
    }

    private async handleUploadCompletion(job: CloudUploadJob): Promise<void> {
        const trajectoryId = job.trajectoryId;
        const timestep = job.timestep;
        const flagKey = `upload:done:${trajectoryId}:${timestep}`;
        const waitListKey = `waiting:upload:${trajectoryId}:${timestep}`;
        const analysisQueueKey = `${Queues.ANALYSIS_PROCESSING}_queue`;

        const lua = `
            redis.call('SET', KEYS[1], '1', 'EX', 600)
            local waiting = redis.call('LRANGE', KEYS[2], 0, -1)
            if #waiting > 0 then
                for i, job in ipairs(waiting) do
                    redis.call('LPUSH', KEYS[3], job)
                end
                redis.call('DEL', KEYS[2])
            end
            return #waiting
        `;

        try {
            await this.redis.eval(lua, 3, flagKey, waitListKey, analysisQueueKey);
        } catch (e) {
            // Log error
        }
    }

    protected deserializeJob(rawData: string): CloudUploadJob {
        return JSON.parse(rawData) as CloudUploadJob;
    }
};