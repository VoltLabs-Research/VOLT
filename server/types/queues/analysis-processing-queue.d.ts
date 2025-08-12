import { BaseJob } from '@/types/queues/base-processing-queue';

export interface AnalysisJob extends BaseJob{
    trajectoryId: string;
    folderPath: string;
    config: any;
    inputFile: string;
    analysisConfigId: string;
}