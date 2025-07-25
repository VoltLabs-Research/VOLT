import { BaseProcessingQueue } from '@/queues/base-processing-queue';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import path from 'path';

export class AnalysisProcessingQueue extends BaseProcessingQueue<AnalysisJob>{
    constructor(){
        const options: QueueOptions = {
            queueName: 'analysis-processing-queue',
            workerPath: path.resolve(__dirname, '../workers/analysis.ts'),
            maxConcurrentJobs: 5,
            cpuLoadThreshold: 80,
            ramLoadThreshold: 85,
        };

        super(options);
    }

    protected deserializeJob(rawData: string): AnalysisJob{
        return JSON.parse(rawData) as AnalysisJob;
    }
}