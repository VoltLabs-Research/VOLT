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
            queueName: process.env.ANALYSIS_QUEUE_NAME || 'analysis',
            workerPath: path.resolve(__dirname, '../workers/analysis.ts'),
            maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_ANALYSES || '2', 10),
            cpuLoadThreshold: parseInt(process.env.CPU_LOAD_THRESHOLD || '80', 10),
            ramLoadThreshold: parseInt(process.env.RAM_LOAD_THRESHOLD || '85', 10)
        };

        super(options);
    }

    protected deserializeJob(rawData: string): AnalysisJob{
        return JSON.parse(rawData) as AnalysisJob;
    }
}