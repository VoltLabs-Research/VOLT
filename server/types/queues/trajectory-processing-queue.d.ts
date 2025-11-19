import { BaseJob } from '@/types/queues/base-processing-queue';

export interface TrajectoryProcessingJob extends BaseJob {
    trajectoryId: string;
    folderId: string; // UUID for MinIO paths
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
