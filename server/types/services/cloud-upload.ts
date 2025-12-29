import { BaseJob } from '@/types/queues/base-processing-queue';

export interface CloudUploadJob extends BaseJob{
    timestep: number;
    trajectoryId: string;
};