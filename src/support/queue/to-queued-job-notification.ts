import type { QueuedJobNotification } from '@/modules/analysis/contracts/http-analysis';

export interface NotifiableJob {
    jobId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    queueType: string;
    metadata?: {
        analysisId?: string;
    };
}

export const toQueuedJobNotification = ({ metadata, ...job }: NotifiableJob, name?: string): QueuedJobNotification => ({
    ...job,
    name,
    analysisId: metadata?.analysisId
});
