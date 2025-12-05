import { BaseJob } from '@/types/queues/base-processing-queue';

export interface TrajectoryProcessingJob extends BaseJob {
    trajectoryId: string;
    chunkIndex: number;
    totalChunks: number;
    sessionStartTime?: string;
    files: {
        // TO DO:
        frameInfo: any;
        frameFilePath: string;
    }[];
    folderPath: string;
    tempFolderPath: string;
}