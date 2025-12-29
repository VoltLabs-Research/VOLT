import { BaseProcessingQueue } from '@/queues/base-processing-queue';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { Queues } from '@/constants/queues';
import { CloudUploadJob } from '@/types/services/cloud-upload';
import * as path from 'node:path';

export class CloudUploadQueue extends BaseProcessingQueue<CloudUploadJob>{
    constructor(){
        const options: QueueOptions = {
            queueName: Queues.CLOUD_UPLOAD,
            workerPath: path.resolve(__dirname, '../workers/cloud-upload.ts')
        };

        super(options);
    }

    protected deserializeJob(rawData: string): CloudUploadJob {
        return JSON.parse(rawData) as CloudUploadJob;
    }
};