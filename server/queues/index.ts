import { AnalysisProcessingQueue } from '@/queues/analysis-processing-queue';

let analysisQueueInstance: AnalysisProcessingQueue | null = null;

export const getAnalysisQueue = (): AnalysisProcessingQueue => {
    if(!analysisQueueInstance){
        analysisQueueInstance = new AnalysisProcessingQueue();
    }

    return analysisQueueInstance;
};