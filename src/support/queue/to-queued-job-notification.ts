import type { QueuedJobNotification } from '@/modules/analysis/contracts/http-analysis';
import type { JobIdentity } from '@/support/contracts/job-identity';

export interface QueueJobLike extends JobIdentity {
    queueType: string;
}

export const toQueuedJobNotification = <TJob extends QueueJobLike>(
    job: TJob,
    name: string
): QueuedJobNotification => ({
    jobId: job.jobId,
    teamId: job.teamId,
    trajectoryId: job.trajectoryId,
    analysisId: job.analysisId,
    pluginId: job.pluginId,
    timestep: job.timestep,
    queueType: job.queueType,
    name
});
