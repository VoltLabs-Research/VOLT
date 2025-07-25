import { BaseProcessingQueue, BaseJob, QueueOptions } from '@/queues/base-processing-queue';
import path from 'path';

export interface TrajectoryProcessingJob extends BaseJob{
    fileBuffer: { type: 'Buffer', data: number[] },
    folderPath: string;
    gltfFolderPath: string;
}

export class TrajectoryProcessingQueue extends BaseProcessingQueue<TrajectoryProcessingJob>{
    constructor(){
        const options: QueueOptions = {
            queueName: 'trajectory-processing',
            workerPath: path.resolve(__dirname, '../workers/trajectory-processing.ts'),
            maxConcurrentJobs: 5,
        };
        
        super(options);
    }

    protected deserializeJob(rawData: string): TrajectoryProcessingJob {
        return JSON.parse(rawData) as TrajectoryProcessingJob;
    }
}