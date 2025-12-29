import { BaseJob } from '@/types/queues/base-processing-queue';

export interface TrajectoryProcessingJob extends BaseJob {
    sessionStartTime?: string;
    file: {
        frameInfo: any;
        frameFilePath: string;
    };
    folderPath: string;
    tempFolderPath: string;
}

