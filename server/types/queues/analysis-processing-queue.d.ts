import { BaseJob } from '@/types/queues/base-processing-queue';

export interface AnalysisJob extends BaseJob {
    trajectoryId: string;
    config: any;
    inputFile: string;
    analysisId: string;
    modifierId: string;
    plugin: string;
    sessionStartTime?: string;
    // ForEach item data - each job processes a single item
    forEachItem?: any;
    forEachIndex?: number;
}
