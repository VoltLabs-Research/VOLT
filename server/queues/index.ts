import { AnalysisProcessingQueue } from '@/queues/analysis-processing-queue';
import { TrajectoryProcessingQueue } from '@/queues/trajectory-processing-queue';

let analysisQueueInstance: AnalysisProcessingQueue | null = null;
let trajectoryProcessingQueueInstance: TrajectoryProcessingQueue | null = null;

export const getAnalysisQueue = (): AnalysisProcessingQueue => {
    if(!analysisQueueInstance){
        analysisQueueInstance = new AnalysisProcessingQueue();
    }

    return analysisQueueInstance;
};

export const getTrajectoryProcessingQueue = (): TrajectoryProcessingQueue => {
    if(!trajectoryProcessingQueueInstance){
        trajectoryProcessingQueueInstance = new TrajectoryProcessingQueue();
    }

    return trajectoryProcessingQueueInstance;
};