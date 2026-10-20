import { FrameJobGroupStatus, JobStatus } from '@volt/contracts/modules/jobs/domain';

import type { Job } from '@volt/contracts/modules/jobs/domain';

export const isRunningJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Running;
};

export const isQueuedJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Queued
        || status === JobStatus.Retrying
        || status === JobStatus.QueuedAfterFailure;
};

export const isCompletedJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Completed;
};

export const isFailedJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Failed;
};

export const computeGroupStatus = (jobs: Job[]): FrameJobGroupStatus => {
    const hasRunning = jobs.some((job) => isRunningJobStatus(job.status));
    const hasQueued = jobs.some((job) => isQueuedJobStatus(job.status));
    const hasFailed = jobs.some((job) => isFailedJobStatus(job.status));
    const hasCompleted = jobs.some((job) => isCompletedJobStatus(job.status));
    const allCompleted = jobs.every((job) => isCompletedJobStatus(job.status));

    if (hasRunning) return FrameJobGroupStatus.Running;
    if (hasQueued) return FrameJobGroupStatus.Queued;
    if (allCompleted) return FrameJobGroupStatus.Completed;
    if (hasFailed && !hasCompleted) return FrameJobGroupStatus.Failed;
    return FrameJobGroupStatus.Partial;
};
