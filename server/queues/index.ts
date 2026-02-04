import { AnalysisProcessingQueue } from '@/queues/analysis-processing-queue';
import { TrajectoryProcessingQueue } from '@/queues/trajectory-processing-queue';
import { RasterizerQueue } from '@/queues/rasterizer-queue';
import { SSHImportQueue } from './ssh-import-queue';
import { CloudUploadQueue } from './cloud-upload';

let analysisQueueInstance: AnalysisProcessingQueue | null = null;
let trajectoryProcessingQueueInstance: TrajectoryProcessingQueue | null = null;
let rasterizerQueue: RasterizerQueue | null = null;
let sshImportQueue: SSHImportQueue | null = null;
let cloudUploadQueue: CloudUploadQueue | null = null;

export const getCloudUploadQueue = (): CloudUploadQueue => {
    if(!cloudUploadQueue){
        cloudUploadQueue = new CloudUploadQueue();
    }

    return cloudUploadQueue;
};

export const getSSHImportQueue = (): SSHImportQueue => {
    if(!sshImportQueue){
        sshImportQueue = new SSHImportQueue();
    }

    return sshImportQueue;
};

export const getAnalysisQueue = (): AnalysisProcessingQueue => {
    if(!analysisQueueInstance){
        analysisQueueInstance = new AnalysisProcessingQueue();
    }

    return analysisQueueInstance;
};

export const getRasterizerQueue = (): RasterizerQueue => {
    if(!rasterizerQueue){
        rasterizerQueue = new RasterizerQueue();
    }

    return rasterizerQueue;
};

export const getTrajectoryProcessingQueue = (): TrajectoryProcessingQueue => {
    if(!trajectoryProcessingQueueInstance){
        trajectoryProcessingQueueInstance = new TrajectoryProcessingQueue();
    }

    return trajectoryProcessingQueueInstance;
};
