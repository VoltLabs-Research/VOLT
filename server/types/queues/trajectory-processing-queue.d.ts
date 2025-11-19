import { BaseJob } from '@/types/queues/base-processing-queue';

export interface TrajectoryProcessingJob extends BaseJob {
    trajectoryId: string;
    chunkIndex: number;
    totalChunks: number;
    sessionStartTime?: string;
    files: {
        // TO DO:
        frameData: any;
        frameFilePath: string;
    }[];
    folderPath: string;
    tempFolderPath: string;
}