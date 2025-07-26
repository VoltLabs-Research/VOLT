import { BaseProcessingQueue } from '@/queues/base-processing-queue';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import path from 'path';

export class TrajectoryProcessingQueue extends BaseProcessingQueue<TrajectoryProcessingJob> {
    constructor(){
        const options: QueueOptions = {
            queueName: 'trajectory-processing-queue',
            workerPath: path.resolve(__dirname, '../workers/trajectory-processing.ts'),
            maxConcurrentJobs: 2,
            cpuLoadThreshold: 60,
            ramLoadThreshold: 70,
            useStreamingAdd: true
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
}