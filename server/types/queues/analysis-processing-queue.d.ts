import { BaseJob } from '@/types/queues/base-processing-queue';

export interface AnalysisJob extends BaseJob{
    trajectoryId: string;
    config: any;
    inputFile: string;
    analysisId: string;
    modifierId: string;
    plugin: string;
    sessionStartTime?: string;
}
