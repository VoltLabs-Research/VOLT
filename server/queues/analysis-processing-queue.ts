import { BaseProcessingQueue, BaseJob, QueueOptions } from '@/queues/base-processing-queue';
import path from 'path';

export interface AnalysisJob extends BaseJob{
    trajectoryId: string;
    folderPath: string;
    config: any;
    inputFile: string;
}

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